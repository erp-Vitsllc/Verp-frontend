'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Country, State, City } from 'country-state-city';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import AvatarEditor from 'react-avatar-editor';
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
import WorkDetailsModal from './components/modals/WorkDetailsModal';
import { formatPhoneForInput, formatPhoneForSave, normalizeText, normalizeContactNumber, getCountryName, getStateName, getFullLocation, sanitizeContact, contactsAreSame, getInitials, formatDate, calculateDaysUntilExpiry, calculateTenure, getAllCountriesOptions, getAllCountryNames } from './utils/helpers';
import { departmentOptions, statusOptions, getDesignationOptions } from './utils/constants';
import { hasPermission, isAdmin } from '@/utils/permissions';


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
    const [alertDialog, setAlertDialog] = useState({
        open: false,
        title: '',
        description: ''
    });
    const [reportingAuthorityOptions, setReportingAuthorityOptions] = useState([]);
    const [reportingAuthorityLoading, setReportingAuthorityLoading] = useState(false);
    const [reportingAuthorityError, setReportingAuthorityError] = useState('');
    const [showPassportModal, setShowPassportModal] = useState(false);
    const [passportForm, setPassportForm] = useState({
        number: '',
        nationality: '',
        issueDate: '',
        expiryDate: '',
        countryOfIssue: '',
        file: null
    });
    const [passportErrors, setPassportErrors] = useState({});
    const [savingPassport, setSavingPassport] = useState(false);
    const [passportFile, setPassportFile] = useState(null);
    const [passportParsing, setPassportParsing] = useState(false);
    const [passportScanError, setPassportScanError] = useState('');
    const [passportScanResult, setPassportScanResult] = useState(null);
    const createEmptyVisaForm = () => ({
        number: '',
        issueDate: '',
        expiryDate: '',
        sponsor: '',
        file: null,
        fileBase64: '',
        fileName: '',
        fileMime: ''
    });
    const [showVisaModal, setShowVisaModal] = useState(false);
    const [showVisaDropdown, setShowVisaDropdown] = useState(false);
    const [selectedVisaType, setSelectedVisaType] = useState('');
    const [savingVisa, setSavingVisa] = useState(false);
    const [showBankModal, setShowBankModal] = useState(false);
    const [bankForm, setBankForm] = useState({
        bankName: '',
        accountName: '',
        accountNumber: '',
        ibanNumber: '',
        swiftCode: '',
        otherDetails: '',
        file: null
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
    const [showAddMoreModal, setShowAddMoreModal] = useState(false);
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
    const [visaErrors, setVisaErrors] = useState({
        visit: {},
        employment: {},
        spouse: {}
    });
    const [visaForms, setVisaForms] = useState({
        visit: createEmptyVisaForm(),
        employment: createEmptyVisaForm(),
        spouse: createEmptyVisaForm()
    });
    const visaTypes = [
        { key: 'visit', label: 'Visit Visa' },
        { key: 'employment', label: 'Employment Visa' },
        { key: 'spouse', label: 'Spouse Visa' }
    ];
    const selectedVisaLabel = visaTypes.find((type) => type.key === selectedVisaType)?.label || '';
    const [statusMessage, setStatusMessage] = useState('');
    const fileInputRef = useRef(null);
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

    // Get all countries for dropdown options

    const passportFieldConfig = [
        { label: 'Passport Number', field: 'number', type: 'text', required: true },
        { label: 'Passport Nationality', field: 'nationality', type: 'select', required: true, options: getAllCountriesOptions() },
        { label: 'Issue Date', field: 'issueDate', type: 'date', required: true },
        { label: 'Expiry Date', field: 'expiryDate', type: 'date', required: true },
        { label: 'Country of Issue', field: 'countryOfIssue', type: 'select', required: true, options: getAllCountriesOptions() }
    ];
    const openEditModal = () => {
        if (!employee || activeTab !== 'basic') return;

        // Format date of birth to yyyy-MM-dd format
        let formattedDateOfBirth = '';
        if (employee.dateOfBirth) {
            const date = new Date(employee.dateOfBirth);
            if (!isNaN(date.getTime())) {
                formattedDateOfBirth = date.toISOString().split('T')[0]; // Extract yyyy-MM-dd
            }
        }

        // Normalize nationality to full country name (never show codes)
        const nationalityValue = employee.nationality || employee.country || '';
        let finalNationality = '';
        if (nationalityValue) {
            const countryName = getCountryName(nationalityValue.toString().trim().toUpperCase());
            finalNationality = countryName || nationalityValue;
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
    };

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

    const handleOpenEducationModal = () => {
        setEducationForm(initialEducationForm);
        setEducationErrors({});
        setEditingEducationId(null);
        setShowEducationModal(true);
    };

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

            if (editingEducationId) {
                // Update existing education
                await axiosInstance.patch(`/Employee/${employeeId}/education/${editingEducationId}`, payload);
                setAlertDialog({
                    open: true,
                    title: "Education Updated",
                    description: "Education details have been updated successfully."
                });
            } else {
                // Add new education
                await axiosInstance.post(`/Employee/${employeeId}/education`, payload);
                setAlertDialog({
                    open: true,
                    title: "Education Added",
                    description: "Education details have been added successfully."
                });
            }

            // Refresh employee data
            await fetchEmployee();
            setShowEducationModal(false);
            setEducationForm(initialEducationForm);
            setEditingEducationId(null);
            setEducationErrors({});
            if (educationCertificateFileRef.current) {
                educationCertificateFileRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to save education:', error);
            setAlertDialog({
                open: true,
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save education details. Please try again."
            });
        } finally {
            setSavingEducation(false);
        }
    };

    const handleEditEducation = (education) => {
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
    };

    const handleDeleteEducation = async (educationId) => {
        if (!educationId) return;

        if (!confirm('Are you sure you want to delete this education record?')) {
            return;
        }

        setDeletingEducationId(educationId);
        try {
            await axiosInstance.delete(`/Employee/${employeeId}/education/${educationId}`);
            setAlertDialog({
                open: true,
                title: "Education Deleted",
                description: "Education record has been deleted successfully."
            });
            // Refresh employee data
            await fetchEmployee();
        } catch (error) {
            console.error('Failed to delete education:', error);
            setAlertDialog({
                open: true,
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to delete education record. Please try again."
            });
        } finally {
            setDeletingEducationId(null);
        }
    };

    // Experience Handlers
    const handleOpenExperienceModal = () => {
        setExperienceForm(initialExperienceForm);
        setExperienceErrors({});
        setEditingExperienceId(null);
        setShowExperienceModal(true);
    };

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

            if (editingExperienceId) {
                await axiosInstance.patch(`/Employee/${employeeId}/experience/${editingExperienceId}`, payload);
                setAlertDialog({
                    open: true,
                    title: "Experience Updated",
                    description: "Experience details have been updated successfully."
                });
            } else {
                await axiosInstance.post(`/Employee/${employeeId}/experience`, payload);
                setAlertDialog({
                    open: true,
                    title: "Experience Added",
                    description: "Experience details have been added successfully."
                });
            }

            await fetchEmployee();
            setShowExperienceModal(false);
            setExperienceForm(initialExperienceForm);
            setEditingExperienceId(null);
            setExperienceErrors({});
            if (experienceCertificateFileRef.current) {
                experienceCertificateFileRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to save experience:', error);
            setAlertDialog({
                open: true,
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save experience details. Please try again."
            });
        } finally {
            setSavingExperience(false);
        }
    };

    const handleEditExperience = (experience) => {
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
    };

    const handleDeleteExperience = async (experienceId) => {
        if (!experienceId) return;

        if (!confirm('Are you sure you want to delete this experience record?')) {
            return;
        }

        setDeletingExperienceId(experienceId);
        try {
            await axiosInstance.delete(`/Employee/${employeeId}/experience/${experienceId}`);
            setAlertDialog({
                open: true,
                title: "Experience Deleted",
                description: "Experience record has been deleted successfully."
            });
            await fetchEmployee();
        } catch (error) {
            console.error('Failed to delete experience:', error);
            setAlertDialog({
                open: true,
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

    const handleDeleteDocument = async (index) => {
        if (!confirm('Are you sure you want to delete this document?')) {
            return;
        }

        setDeletingDocumentIndex(index);
        try {
            const updatedDocuments = [...(employee?.documents || [])];
            updatedDocuments.splice(index, 1);

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                documents: updatedDocuments
            });
            await fetchEmployee();
            setAlertDialog({
                open: true,
                title: "Document Deleted",
                description: "Document has been deleted successfully."
            });
        } catch (error) {
            console.error('Failed to delete document:', error);
            setAlertDialog({
                open: true,
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to delete document. Please try again."
            });
        } finally {
            setDeletingDocumentIndex(null);
        }
    };

    const handleSaveDocument = async () => {
        if (!documentForm.type || !documentForm.type.trim()) {
            setDocumentErrors({ type: 'Document type is required' });
            return;
        }
        if (!documentForm.fileBase64 && editingDocumentIndex === null) {
            setDocumentErrors({ file: 'Document file is required' });
            return;
        }

        setSavingDocument(true);
        try {
            const documentData = {
                type: documentForm.type.trim(),
                document: documentForm.fileBase64 ? {
                    data: documentForm.fileBase64,
                    name: documentForm.fileName,
                    mimeType: documentForm.fileMime
                } : (editingDocumentIndex !== null && employee?.documents?.[editingDocumentIndex]?.document ? employee.documents[editingDocumentIndex].document : undefined)
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

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                documents: updatedDocuments
            });
            await fetchEmployee();
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
            setAlertDialog({
                open: true,
                title: editingDocumentIndex !== null ? "Document Updated" : "Document Added",
                description: editingDocumentIndex !== null ? "Document has been updated successfully." : "Document has been added successfully."
            });
        } catch (error) {
            console.error('Failed to save document:', error);
            setAlertDialog({
                open: true,
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save document. Please try again."
            });
        } finally {
            setSavingDocument(false);
        }
    };

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

    const handleSaveTraining = async () => {
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
            const trainingData = {
                trainingName: trainingForm.trainingName.trim(),
                trainingDetails: trainingForm.trainingDetails?.trim() || '',
                trainingFrom: trainingForm.trainingFrom.trim(),
                trainingDate: trainingForm.trainingDate,
                trainingCost: trainingForm.trainingCost ? parseFloat(trainingForm.trainingCost) : null,
                certificate: trainingForm.certificateBase64 ? {
                    data: trainingForm.certificateBase64,
                    name: trainingForm.certificateName,
                    mimeType: trainingForm.certificateMime
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
            await fetchEmployee();
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
            setAlertDialog({
                open: true,
                title: editingTrainingIndex !== null ? "Training Updated" : "Training Added",
                description: editingTrainingIndex !== null ? "Training has been updated successfully." : "Training has been added successfully."
            });
        } catch (error) {
            console.error('Failed to save training:', error);
            setAlertDialog({
                open: true,
                title: "Error",
                description: error.response?.data?.message || error.message || "Failed to save training. Please try again."
            });
        } finally {
            setSavingTraining(false);
        }
    };

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
            setAlertDialog({
                open: true,
                title: "Work details updated",
                description: "Changes were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update work details', error);
            setAlertDialog({
                open: true,
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setUpdatingWorkDetails(false);
        }
    };

    const handleOpenPersonalModal = () => {
        if (!employee || activeTab !== 'personal') return;

        // Normalize nationality to full country name (never show codes)
        const nationalityValue = employee.nationality || employee.country || '';
        let finalNationality = '';
        if (nationalityValue) {
            // First try to get country name from code
            const countryName = getCountryName(nationalityValue.toString().trim().toUpperCase());

            // If getCountryName returns a name (different from input), use it
            if (countryName && countryName !== nationalityValue.toString().trim()) {
                finalNationality = countryName;
            } else {
                // It might already be a country name, try to find exact match in dropdown options
                const countryOptions = getAllCountriesOptions();
                const normalizedInput = nationalityValue.toString().trim();
                const exactMatch = countryOptions.find(
                    option => option.value.toLowerCase() === normalizedInput.toLowerCase()
                );

                if (exactMatch) {
                    finalNationality = exactMatch.value; // Use exact value from dropdown
                } else {
                    // Fallback: use the value as-is (might be a valid country name not in our list)
                    finalNationality = normalizedInput;
                }
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
        const existingContacts = getExistingContacts();
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

    const handlePassportChange = (field, value) => {
        // Apply input restrictions
        let processedValue = value;

        // Passport number: only alphanumeric, no special characters
        if (field === 'number') {
            processedValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        }
        // For select fields (nationality, countryOfIssue), use value as-is
        // No processing needed for select dropdowns

        setPassportForm(prev => ({ ...prev, [field]: processedValue }));

        // Clear error for this field when user starts typing/selecting
        if (passportErrors[field]) {
            setPassportErrors(prev => {
                const updated = { ...prev };
                delete updated[field];
                return updated;
            });
        }

        // Real-time validation
        validatePassportField(field, processedValue);
    };

    // Validate individual passport field
    const validatePassportField = (field, value) => {
        const errors = { ...passportErrors };
        let error = '';

        if (field === 'number') {
            if (!value || value.trim() === '') {
                error = 'Passport number is required';
            } else if (!/^[A-Za-z0-9]+$/.test(value)) {
                error = 'Passport number must be alphanumeric with no special characters';
            }
        } else if (field === 'nationality') {
            if (!value || value.trim() === '') {
                error = 'Passport nationality is required';
            } else {
                const validCountries = getAllCountryNames();
                if (!validCountries.includes(value.trim())) {
                    error = 'Please select a valid country from the list';
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
                    } else if (passportForm.expiryDate) {
                        // Re-validate expiry date when issue date changes
                        const expiryDate = new Date(passportForm.expiryDate);
                        if (expiryDate <= issueDate) {
                            errors.expiryDate = 'Expiry date must be later than the issue date';
                        } else {
                            // Clear expiry date error if it's now valid
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
                    } else if (passportForm.issueDate) {
                        const issueDate = new Date(passportForm.issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        } else if (field === 'countryOfIssue') {
            if (!value || value.trim() === '') {
                error = 'Country of issue is required';
            } else {
                const validCountries = getAllCountryNames();
                if (!validCountries.includes(value.trim())) {
                    error = 'Please select a valid country from the list';
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }
        setPassportErrors(errors);
    };


    // Handle passport file upload
    // File change handlers
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

    const handlePassportFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setPassportForm(prev => ({ ...prev, file: null }));
            setPassportErrors(prev => {
                const updated = { ...prev };
                updated.file = 'Passport copy is required';
                return updated;
            });
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setPassportErrors(prev => ({
                ...prev,
                file: 'Only PDF, JPEG, or PNG file formats are allowed'
            }));
            // Clear the file input
            if (e.target) {
                e.target.value = '';
            }
            return;
        }

        // Clear file error if valid
        setPassportErrors(prev => {
            const updated = { ...prev };
            delete updated.file;
            return updated;
        });

        // Set the file
        setPassportForm(prev => ({ ...prev, file }));
    };






    // Get all countries for validation

    const validatePassportForm = () => {
        const errors = {};

        // 1. Passport Number - Required, alphanumeric, no special characters
        if (!passportForm.number || passportForm.number.trim() === '') {
            errors.number = 'Passport number is required';
        } else if (!/^[A-Za-z0-9]+$/.test(passportForm.number.trim())) {
            errors.number = 'Passport number must be alphanumeric with no special characters';
        }

        // 2. Passport Nationality - Required, must be from valid country list
        if (!passportForm.nationality || passportForm.nationality.trim() === '') {
            errors.nationality = 'Passport nationality is required';
        } else {
            const validCountries = getAllCountryNames();
            if (!validCountries.includes(passportForm.nationality.trim())) {
                errors.nationality = 'Please select a valid country from the list';
            }
        }

        // 3. Issue Date - Required, valid date, must be past date
        if (!passportForm.issueDate || passportForm.issueDate.trim() === '') {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(passportForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(passportForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                }
            }
        }

        // 4. Expiry Date - Required, valid date, must be future date, must be after issue date
        if (!passportForm.expiryDate || passportForm.expiryDate.trim() === '') {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(passportForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(passportForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (passportForm.issueDate) {
                    const issueDate = new Date(passportForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // 5. Country of Issue - Required, must be from valid country list
        if (!passportForm.countryOfIssue || passportForm.countryOfIssue.trim() === '') {
            errors.countryOfIssue = 'Country of issue is required';
        } else {
            const validCountries = getAllCountryNames();
            if (!validCountries.includes(passportForm.countryOfIssue.trim())) {
                errors.countryOfIssue = 'Please select a valid country from the list';
            }
        }

        // 6. Passport Copy - Required, only PDF, JPEG, or PNG
        if (!passportForm.file) {
            errors.file = 'Passport copy is required';
        } else {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
            const fileExtension = '.' + passportForm.file.name.split('.').pop().toLowerCase();

            if (!allowedTypes.includes(passportForm.file.type) && !allowedExtensions.includes(fileExtension)) {
                errors.file = 'Only PDF, JPEG, or PNG file formats are allowed';
            }
        }

        setPassportErrors(errors);
        return Object.keys(errors).length === 0;
    };

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

    const handlePassportSubmit = async () => {
        // Validate form
        if (!validatePassportForm()) {
            setAlertDialog({
                open: true,
                title: "Validation Error",
                description: "Please fill in all required fields."
            });
            return;
        }

        try {
            setSavingPassport(true);

            // Convert file to base64 if exists
            let passportCopyBase64 = null;
            let passportCopyName = '';
            let passportCopyMime = '';

            if (passportForm.file) {
                passportCopyBase64 = await fileToBase64(passportForm.file);
                passportCopyName = passportForm.file.name;
                passportCopyMime = passportForm.file.type;
            }

            // Prepare payload
            const payload = {
                number: passportForm.number.trim(),
                nationality: passportForm.nationality.trim(),
                issueDate: passportForm.issueDate,
                expiryDate: passportForm.expiryDate,
                placeOfIssue: passportForm.countryOfIssue.trim(),
                passportCopy: passportCopyBase64,
                passportCopyName: passportCopyName,
                passportCopyMime: passportCopyMime,
            };

            console.log('Saving passport details for employee:', employeeId);

            // Call API to save passport details
            const response = await axiosInstance.patch(`/Employee/passport/${employeeId}`, payload);

            console.log('Passport details saved successfully:', response.data);

            // Refresh employee data to get updated passport info
            await fetchEmployee();

            setShowPassportModal(false);
            setAlertDialog({
                open: true,
                title: "Passport details updated",
                description: "Passport information has been saved successfully."
            });

            // Reset form and file input
            setPassportForm({
                number: '',
                nationality: '',
                issueDate: '',
                expiryDate: '',
                countryOfIssue: '',
                file: null
            });
            setPassportErrors({});
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (error) {
            console.error('Failed to save passport details', error);
            setAlertDialog({
                open: true,
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingPassport(false);
        }
    };

    // Helper function to convert base64 string to File object
    const base64ToFile = (base64String, fileName, mimeType) => {
        try {
            // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
            let base64Data = base64String;
            if (base64String.includes(',')) {
                base64Data = base64String.split(',')[1];
            }
            // Remove any whitespace
            base64Data = base64Data.trim();

            // Decode base64
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType || 'application/pdf' });
            return new File([blob], fileName || 'document.pdf', { type: mimeType || 'application/pdf' });
        } catch (error) {
            console.error('Error converting base64 to file:', error);
            return null;
        }
    };

    // Open passport modal and populate form with existing data
    const handleOpenPassportModal = () => {
        // Get nationality from basic details as fallback and convert to full country name
        const basicNationalityCode = employee?.nationality || employee?.country || '';
        const basicNationality = basicNationalityCode ? getCountryName(basicNationalityCode) : '';

        if (employee?.passportDetails) {
            // Convert passport nationality to full country name if it's a code
            const passportNationalityCode = employee.passportDetails.nationality || '';
            const passportNationality = passportNationalityCode ? getCountryName(passportNationalityCode) : '';

            // Convert country of issue to full country name if it's a code
            const countryOfIssueCode = employee.passportDetails.placeOfIssue || '';
            const countryOfIssue = countryOfIssueCode ? getCountryName(countryOfIssueCode) : '';

            setPassportForm({
                number: employee.passportDetails.number || '',
                nationality: passportNationality || basicNationality,
                issueDate: employee.passportDetails.issueDate ? employee.passportDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.passportDetails.expiryDate ? employee.passportDetails.expiryDate.substring(0, 10) : '',
                countryOfIssue: countryOfIssue || '',
                file: null
            });
            // If document exists in DB, create a file object for display
            if (employee.passportDetails.document?.data) {
                const file = base64ToFile(
                    employee.passportDetails.document.data,
                    employee.passportDetails.document.name || 'passport.pdf',
                    employee.passportDetails.document.mimeType || 'application/pdf'
                );
                if (file) {
                    setPassportForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setPassportForm({
                number: '',
                nationality: basicNationality,
                issueDate: '',
                expiryDate: '',
                countryOfIssue: '',
                file: null
            });
        }
        setPassportErrors({});
        setShowPassportModal(true);
    };

    // Reset form when modal closes
    const handleClosePassportModal = () => {
        if (!savingPassport) {
            setShowPassportModal(false);
            setPassportForm({
                number: '',
                nationality: '',
                issueDate: '',
                expiryDate: '',
                countryOfIssue: '',
                file: null
            });
            setPassportErrors({});
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    const handleCloseVisaModal = () => {
        if (savingVisa) return;
        setShowVisaModal(false);
        setSelectedVisaType('');
        setShowVisaDropdown(false);
    };

    // Emirates ID Handlers
    const handleOpenEmiratesIdModal = () => {
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
    };

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
        if (!emiratesIdForm.number || !emiratesIdForm.number.trim()) {
            errors.number = 'Emirates ID number is required';
        }
        if (!emiratesIdForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        }
        if (!emiratesIdForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        }
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

            if (emiratesIdForm.file) {
                upload = await fileToBase64(emiratesIdForm.file);
                uploadName = emiratesIdForm.file.name;
                uploadMime = emiratesIdForm.file.type;
            } else if (employee?.emiratesIdDetails?.document?.data) {
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

            await fetchEmployee();
            handleCloseEmiratesIdModal();
            setAlertDialog({
                open: true,
                title: "Emirates ID updated",
                description: "Emirates ID information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Emirates ID', error);
            setAlertDialog({
                open: true,
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingEmiratesId(false);
        }
    };

    // Labour Card Handlers
    const handleOpenLabourCardModal = () => {
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
    };

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
        if (!labourCardForm.number || !labourCardForm.number.trim()) {
            errors.number = 'Labour Card number is required';
        }
        if (!labourCardForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        }
        if (!labourCardForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        }
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

            if (labourCardForm.file) {
                upload = await fileToBase64(labourCardForm.file);
                uploadName = labourCardForm.file.name;
                uploadMime = labourCardForm.file.type;
            } else if (employee?.labourCardDetails?.document?.data) {
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
            setAlertDialog({
                open: true,
                title: "Labour Card updated",
                description: "Labour Card information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Labour Card', error);
            setAlertDialog({
                open: true,
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingLabourCard(false);
        }
    };

    // Medical Insurance Handlers
    const handleOpenMedicalInsuranceModal = () => {
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
    };

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
        if (!medicalInsuranceForm.provider || !medicalInsuranceForm.provider.trim()) {
            errors.provider = 'Provider is required';
        }
        if (!medicalInsuranceForm.number || !medicalInsuranceForm.number.trim()) {
            errors.number = 'Policy number is required';
        }
        if (!medicalInsuranceForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        }
        if (!medicalInsuranceForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        }
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

            if (medicalInsuranceForm.file) {
                upload = await fileToBase64(medicalInsuranceForm.file);
                uploadName = medicalInsuranceForm.file.name;
                uploadMime = medicalInsuranceForm.file.type;
            } else if (employee?.medicalInsuranceDetails?.document?.data) {
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
            setAlertDialog({
                open: true,
                title: "Medical Insurance updated",
                description: "Medical Insurance information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Medical Insurance', error);
            setAlertDialog({
                open: true,
                title: "Update failed",
                description: error.response?.data?.message || error.message || "Something went wrong."
            });
        } finally {
            setSavingMedicalInsurance(false);
        }
    };

    // Driving License Handlers
    const handleOpenDrivingLicenseModal = () => {
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
    };

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
        if (!drivingLicenseForm.number || !drivingLicenseForm.number.trim()) {
            errors.number = 'Driving License number is required';
        }
        if (!drivingLicenseForm.issueDate) {
            errors.issueDate = 'Issue date is required';
        }
        if (!drivingLicenseForm.expiryDate) {
            errors.expiryDate = 'Expiry date is required';
        }
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

            if (drivingLicenseForm.file) {
                upload = await fileToBase64(drivingLicenseForm.file);
                uploadName = drivingLicenseForm.file.name;
                uploadMime = drivingLicenseForm.file.type;
            } else if (employee?.drivingLicenceDetails?.document?.data) {
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
            setAlertDialog({
                open: true,
                title: "Driving License updated",
                description: "Driving License information has been saved successfully."
            });
        } catch (error) {
            console.error('Failed to save Driving License', error);
            setAlertDialog({
                open: true,
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
            setBankForm({
                bankName: employee.bankName || employee.bank || '',
                accountName: employee.accountName || employee.bankAccountName || '',
                accountNumber: employee.accountNumber || employee.bankAccountNumber || '',
                ibanNumber: employee.ibanNumber || '',
                swiftCode: employee.swiftCode || employee.ifscCode || employee.ifsc || '',
                otherDetails: employee.bankOtherDetails || employee.otherBankDetails || '',
                file: null
            });
            if (employee.bankAttachment?.data) {
                const file = base64ToFile(
                    employee.bankAttachment.data,
                    employee.bankAttachment.name || 'bank-attachment.pdf',
                    employee.bankAttachment.mimeType || 'application/pdf'
                );
                if (file) {
                    setBankForm(prev => ({ ...prev, file }));
                }
            }
        } else {
            setBankForm({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ibanNumber: '',
                swiftCode: '',
                otherDetails: '',
                file: null
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
                file: null
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
            setBankForm(prev => ({ ...prev, file: null }));
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

        setBankForm(prev => ({ ...prev, file }));
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
            otherDetails: ''
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

            let bankAttachment = null;
            let bankAttachmentName = '';
            let bankAttachmentMime = '';

            if (bankForm.file) {
                bankAttachment = await fileToBase64(bankForm.file);
                bankAttachmentName = bankForm.file.name;
                bankAttachmentMime = bankForm.file.type;
            } else if (employee?.bankAttachment?.data) {
                bankAttachment = employee.bankAttachment.data;
                bankAttachmentName = employee.bankAttachment.name;
                bankAttachmentMime = employee.bankAttachment.mimeType;
            }

            const payload = {
                bankName: bankForm.bankName.trim(),
                accountName: bankForm.accountName.trim(),
                accountNumber: bankForm.accountNumber.trim(),
                ibanNumber: bankForm.ibanNumber.trim().toUpperCase(),
                swiftCode: bankForm.swiftCode.trim().toUpperCase(),
                bankOtherDetails: bankForm.otherDetails.trim(),
                bankAttachment: bankAttachment ? {
                    data: bankAttachment,
                    name: bankAttachmentName,
                    mimeType: bankAttachmentMime
                } : undefined
            };
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);
            await fetchEmployee();
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
            setAlertDialog({
                open: true,
                title: "Salary Bank Account Updated",
                description: "Salary bank account details were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update bank details', error);
            setAlertDialog({
                open: true,
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

            if (hasSalaryDetails() && employee.salaryHistory && employee.salaryHistory.length > 0) {
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

            // Get offer letter from active entry or main employee offerLetter
            let offerLetterFile = null;
            if (hasSalaryDetails() && employee.salaryHistory && employee.salaryHistory.length > 0) {
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                if (activeEntry?.offerLetter?.data) {
                    const file = base64ToFile(
                        activeEntry.offerLetter.data,
                        activeEntry.offerLetter.name || 'offer-letter.pdf',
                        activeEntry.offerLetter.mimeType || 'application/pdf'
                    );
                    if (file) {
                        offerLetterFile = file;
                    }
                } else if (employee.offerLetter?.data) {
                    const file = base64ToFile(
                        employee.offerLetter.data,
                        employee.offerLetter.name || 'offer-letter.pdf',
                        employee.offerLetter.mimeType || 'application/pdf'
                    );
                    if (file) {
                        offerLetterFile = file;
                    }
                }
            } else if (employee.offerLetter?.data) {
                const file = base64ToFile(
                    employee.offerLetter.data,
                    employee.offerLetter.name || 'offer-letter.pdf',
                    employee.offerLetter.mimeType || 'application/pdf'
                );
                if (file) {
                    offerLetterFile = file;
                }
            }

            // Get offer letter data from active entry or main employee
            let offerLetterData = null;
            let offerLetterName = '';
            let offerLetterMime = '';
            if (hasSalaryDetails() && employee.salaryHistory && employee.salaryHistory.length > 0) {
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                if (activeEntry?.offerLetter?.data) {
                    offerLetterData = activeEntry.offerLetter.data;
                    offerLetterName = activeEntry.offerLetter.name || 'offer-letter.pdf';
                    offerLetterMime = activeEntry.offerLetter.mimeType || 'application/pdf';
                } else if (employee.offerLetter?.data) {
                    offerLetterData = employee.offerLetter.data;
                    offerLetterName = employee.offerLetter.name || 'offer-letter.pdf';
                    offerLetterMime = employee.offerLetter.mimeType || 'application/pdf';
                }
            } else if (employee.offerLetter?.data) {
                offerLetterData = employee.offerLetter.data;
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
                offerLetterFile: offerLetterFile,
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
            setSalaryFormErrors(prev => ({ ...prev, fromDate: '' }));
        } else if (field === 'basic' || field === 'houseRentAllowance' || field === 'vehicleAllowance' || field === 'fuelAllowance' || field === 'otherAllowance') {
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

            // Auto-calculate total salary
            const total = calculateTotalSalary(
                field === 'basic' ? sanitizedValue : updatedForm.basic,
                field === 'houseRentAllowance' ? sanitizedValue : updatedForm.houseRentAllowance,
                field === 'vehicleAllowance' ? sanitizedValue : updatedForm.vehicleAllowance,
                field === 'fuelAllowance' ? sanitizedValue : updatedForm.fuelAllowance,
                field === 'otherAllowance' ? sanitizedValue : updatedForm.otherAllowance
            );
            updatedForm.totalSalary = total;
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

        // Validate From Date
        if (!salaryForm.fromDate || salaryForm.fromDate.trim() === '') {
            errors.fromDate = 'From Date is required';
            hasErrors = true;
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
                return entryToEdit?.offerLetter?.data ? true : false;
            } else if (hasSalaryDetails() && employee?.salaryHistory) {
                const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                return activeEntry?.offerLetter?.data ? true : false;
            }
            return employee?.offerLetter?.data ? true : false;
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
                if (salaryForm.offerLetterFileBase64) {
                    updatedEntry.offerLetter = {
                        data: salaryForm.offerLetterFileBase64,
                        name: salaryForm.offerLetterFileName || salaryForm.offerLetterFile?.name || 'offer-letter.pdf',
                        mimeType: salaryForm.offerLetterFileMime || salaryForm.offerLetterFile?.type || 'application/pdf'
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
                const isEditingInitialSalary = hasSalaryDetails();

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
                    if (salaryForm.offerLetterFileBase64) {
                        newInitialSalaryEntry.offerLetter = {
                            data: salaryForm.offerLetterFileBase64,
                            name: salaryForm.offerLetterFileName || salaryForm.offerLetterFile?.name || 'offer-letter.pdf',
                            mimeType: salaryForm.offerLetterFileMime || salaryForm.offerLetterFile?.type || 'application/pdf'
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
                    if (salaryForm.offerLetterFileBase64) {
                        newHistoryEntry.offerLetter = {
                            data: salaryForm.offerLetterFileBase64,
                            name: salaryForm.offerLetterFileName || salaryForm.offerLetterFile?.name || 'offer-letter.pdf',
                            mimeType: salaryForm.offerLetterFileMime || salaryForm.offerLetterFile?.type || 'application/pdf'
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
            await fetchEmployee();
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
            setAlertDialog({
                open: true,
                title: editingSalaryIndex !== null ? "Salary Record Updated" : "Salary Record Added",
                description: editingSalaryIndex !== null
                    ? "Salary record was updated successfully."
                    : "Salary record was added successfully."
            });
        } catch (error) {
            console.error('Failed to update salary details', error);
            setAlertDialog({
                open: true,
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

        // Load states for the selected country
        if (countryCode) {
            const country = Country.getCountryByCode(countryCode);
            if (country) {
                const states = State.getStatesOfCountry(country.isoCode).map(state => ({
                    label: state.name,
                    value: state.name
                }));
                setAddressStateOptions(states);
            } else {
                // Try to find by name
                const countryByName = Country.getAllCountries().find(c => c.name === countryFullName);
                if (countryByName) {
                    const states = State.getStatesOfCountry(countryByName.isoCode).map(state => ({
                        label: state.name,
                        value: state.name
                    }));
                    setAddressStateOptions(states);
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
                    setAddressStateOptions(states);
                } else {
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
            setAlertDialog({
                open: true,
                title: "Personal details updated",
                description: "Personal information saved successfully."
            });
        } catch (error) {
            console.error('Failed to update personal details', error);
            setAlertDialog({
                open: true,
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
            } else if (!/^[A-Za-z\s]+$/.test(addressForm.state.trim())) {
                errors.state = 'Emirates/State must contain letters and spaces only';
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
            setAlertDialog({
                open: true,
                title: `${addressModalType === 'permanent' ? 'Permanent' : 'Current'} address saved`,
                description: "Address details were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update address', error);
            setAlertDialog({
                open: true,
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
                const updatedContacts = getExistingContacts()
                    .filter((_, index) => index !== contactIndex)
                    .map(sanitizeContact)
                    .filter(contact => contact.name && contact.number);

                await persistContacts(updatedContacts);
            }

            await fetchEmployee();
            setAlertDialog({
                open: true,
                title: "Contact removed",
                description: "Emergency contact deleted successfully."
            });
        } catch (error) {
            console.error('Failed to delete contact details', error);
            setAlertDialog({
                open: true,
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
                setAlertDialog({
                    open: true,
                    title: "Contact details missing",
                    description: "Please provide at least one contact with a name and phone number."
                });
                setSavingContact(false);
                return;
            }

            const newContact = filteredContacts[0];
            const existingContacts = getExistingContacts()
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
                    const updatedContacts = [...existingContacts];
                    const targetIndex = editingContactIndex ?? existingContacts.findIndex(contact => contactsAreSame(contact, newContact));

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
                const duplicateContact = existingContacts.find(contact => contactsAreSame(contact, newContact));

                if (duplicateContact) {
                    if (duplicateContact.id) {
                        await axiosInstance.patch(`/Employee/${employeeId}/emergency-contact/${duplicateContact.id}`, newContact);
                    } else {
                        const updatedContacts = existingContacts.map(contact =>
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
            setAlertDialog({
                open: true,
                title: "Contact details saved",
                description: "Emergency contact details were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update contact details', error);
            setAlertDialog({
                open: true,
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
            setAlertDialog({
                open: true,
                title: "Reporting To missing",
                description: "Please assign someone to report to with a valid email before submitting for approval."
            });
            return;
        }
        try {
            setSendingApproval(true);
            await axiosInstance.post(`/Employee/${employeeId}/send-approval-email`);
            await fetchEmployee();
            setAlertDialog({
                open: true,
                title: "Request sent",
                description: "Notification sent to the reporting authority. Waiting for activation."
            });
        } catch (error) {
            console.error('Failed to send approval request', error);
            setAlertDialog({
                open: true,
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
            setAlertDialog({
                open: true,
                title: "Profile activated",
                description: "The employee profile has been activated."
            });
        } catch (error) {
            console.error('Failed to activate profile', error);
            setAlertDialog({
                open: true,
                title: "Activation failed",
                description: error.response?.data?.message || error.message || "Could not activate profile."
            });
        } finally {
            setActivatingProfile(false);
        }
    };

    // Check if employee nationality is UAE (handles both code and full name)
    const isUAENationality = () => {
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
    };

    const handleVisaButtonClick = () => {
        if (isUAENationality()) {
            setAlertDialog({
                open: true,
                title: "Visa Not Required",
                description: "Visa details are only required for employees whose nationality is not UAE."
            });
            return;
        }
        setShowVisaDropdown(prev => !prev);
    };

    // Open visa modal and populate with existing data
    const handleOpenVisaModal = (visaType) => {
        if (isUAENationality()) {
            setAlertDialog({
                open: true,
                title: "Visa Not Required",
                description: "Visa details are only required for employees whose nationality is not UAE."
            });
            return;
        }

        // If visaType is provided, open that specific visa modal
        if (visaType) {
            setSelectedVisaType(visaType);
            setShowVisaDropdown(false);

            // Populate visa form with existing data if available
            if (employee?.visaDetails?.[visaType]) {
                const details = employee.visaDetails[visaType];

                // Format dates to yyyy-MM-dd format
                let formattedIssueDate = '';
                if (details.issueDate) {
                    const issueDate = new Date(details.issueDate);
                    if (!isNaN(issueDate.getTime())) {
                        formattedIssueDate = issueDate.toISOString().split('T')[0];
                    } else {
                        formattedIssueDate = details.issueDate.includes('T')
                            ? details.issueDate.split('T')[0]
                            : details.issueDate.substring(0, 10);
                    }
                }

                let formattedExpiryDate = '';
                if (details.expiryDate) {
                    const expiryDate = new Date(details.expiryDate);
                    if (!isNaN(expiryDate.getTime())) {
                        formattedExpiryDate = expiryDate.toISOString().split('T')[0];
                    } else {
                        formattedExpiryDate = details.expiryDate.includes('T')
                            ? details.expiryDate.split('T')[0]
                            : details.expiryDate.substring(0, 10);
                    }
                }

                const formData = {
                    number: details.number || '',
                    issueDate: formattedIssueDate,
                    expiryDate: formattedExpiryDate,
                    sponsor: details.sponsor || '',
                    file: null,
                    fileBase64: details.document?.data || '',
                    fileName: details.document?.name || '',
                    fileMime: details.document?.mimeType || ''
                };

                // If document exists in DB, create a file object for display
                if (details.document?.data) {
                    const file = base64ToFile(
                        details.document.data,
                        details.document.name || `${visaType}_visa.pdf`,
                        details.document.mimeType || 'application/pdf'
                    );
                    if (file) {
                        formData.file = file;
                    }
                }

                setVisaForms(prev => ({
                    ...prev,
                    [visaType]: formData
                }));
            } else {
                // Reset to empty form if no data exists
                setVisaForms(prev => ({
                    ...prev,
                    [visaType]: createEmptyVisaForm()
                }));
            }

            setShowVisaModal(true);
        } else {
            // If no visaType, check which visas exist and open dropdown or direct modal
            const existingVisas = [];
            if (employee?.visaDetails?.visit?.number) existingVisas.push('visit');
            if (employee?.visaDetails?.employment?.number) existingVisas.push('employment');
            if (employee?.visaDetails?.spouse?.number) existingVisas.push('spouse');

            if (existingVisas.length === 1) {
                // Only one visa exists, open it directly
                handleOpenVisaModal(existingVisas[0]);
            } else {
                // Multiple visas or none, show dropdown
                setShowVisaDropdown(prev => !prev);
            }
        }
    };

    const handleVisaDropdownChange = (value) => {
        if (isUAENationality()) {
            setSelectedVisaType('');
            setShowVisaDropdown(false);
            return;
        }
        if (!value) {
            setSelectedVisaType('');
            setShowVisaDropdown(false);
            return;
        }
        setSelectedVisaType(value);
        setShowVisaDropdown(false);

        // Populate visa form with existing data if available
        if (employee?.visaDetails?.[value]) {
            const details = employee.visaDetails[value];
            const formData = {
                number: details.number || '',
                issueDate: details.issueDate ? details.issueDate.substring(0, 10) : '',
                expiryDate: details.expiryDate ? details.expiryDate.substring(0, 10) : '',
                sponsor: details.sponsor || '',
                file: null,
                fileBase64: details.document?.data || '',
                fileName: details.document?.name || '',
                fileMime: details.document?.mimeType || ''
            };

            // If document exists in DB, create a file object for display
            if (details.document?.data) {
                const file = base64ToFile(
                    details.document.data,
                    details.document.name || `${value}_visa.pdf`,
                    details.document.mimeType || 'application/pdf'
                );
                if (file) {
                    formData.file = file;
                }
            }

            setVisaForms(prev => ({
                ...prev,
                [value]: formData
            }));
        } else {
            // Reset to empty form if no data exists
            setVisaForms(prev => ({
                ...prev,
                [value]: createEmptyVisaForm()
            }));
        }

        setShowVisaModal(true);
    };

    const handleVisaFieldChange = (type, field, value) => {
        // Apply input restrictions
        let processedValue = value;

        // Visa number: only alphanumeric, no special characters
        if (field === 'number') {
            processedValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        }

        // Sponsor: letters, numbers, and spaces only
        if (field === 'sponsor') {
            processedValue = value.replace(/[^A-Za-z0-9\s]/g, '');
        }

        setVisaForms(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: processedValue
            }
        }));

        // Clear error for this field when user starts typing
        if (visaErrors[type]?.[field]) {
            setVisaErrors(prev => ({
                ...prev,
                [type]: { ...prev[type], [field]: '' }
            }));
        }

        // Real-time validation
        validateVisaField(type, field, processedValue);
    };

    // Validate individual visa field
    const validateVisaField = (type, field, value) => {
        const errors = { ...(visaErrors[type] || {}) };
        let error = '';

        if (field === 'number') {
            if (!value || value.trim() === '') {
                error = 'Visa number is required';
            } else if (!/^[A-Za-z0-9]+$/.test(value)) {
                error = 'Visa number must be alphanumeric with no special characters';
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
                    } else if (visaForms[type].expiryDate) {
                        // Re-validate expiry date when issue date changes
                        const expiryDate = new Date(visaForms[type].expiryDate);
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
                    } else if (visaForms[type].issueDate) {
                        const issueDate = new Date(visaForms[type].issueDate);
                        if (expiryDate <= issueDate) {
                            error = 'Expiry date must be later than the issue date';
                        }
                    }
                }
            }
        } else if (field === 'sponsor') {
            if (!value || value.trim() === '') {
                error = 'Sponsor is required';
            } else {
                const trimmedSponsor = value.trim();
                if (trimmedSponsor.length < 2) {
                    error = 'Sponsor must be at least 2 characters';
                } else if (!/^[A-Za-z0-9\s]+$/.test(trimmedSponsor)) {
                    error = 'Sponsor must contain only letters, numbers, and spaces';
                }
            }
        }

        if (error) {
            errors[field] = error;
        } else {
            delete errors[field];
        }

        setVisaErrors(prev => ({
            ...prev,
            [type]: errors
        }));
    };

    const handleVisaFileChange = (type, file) => {
        if (!file) {
            setVisaForms(prev => ({
                ...prev,
                [type]: {
                    ...prev[type],
                    file: null,
                    fileBase64: '',
                    fileName: '',
                    fileMime: ''
                }
            }));
            setVisaErrors(prev => ({
                ...prev,
                [type]: { ...(prev[type] || {}), file: 'Visa copy is required' }
            }));
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
            setVisaErrors(prev => ({
                ...prev,
                [type]: { ...(prev[type] || {}), file: 'Only PDF, JPEG, or PNG file formats are allowed' }
            }));
            return;
        }

        // Clear file error if valid
        setVisaErrors(prev => ({
            ...prev,
            [type]: { ...(prev[type] || {}), file: '' }
        }));

        const reader = new FileReader();
        reader.onloadend = () => {
            setVisaForms(prev => ({
                ...prev,
                [type]: {
                    ...prev[type],
                    file,
                    fileBase64: typeof reader.result === 'string' ? reader.result : '',
                    fileName: file.name,
                    fileMime: file.type
                }
            }));
        };
        reader.readAsDataURL(file);
    };

    const validateVisaForm = (type) => {
        const currentForm = visaForms[type];
        const errors = {};

        // 1. Visa Number - Required, alphanumeric, no special characters
        if (!currentForm.number || currentForm.number.trim() === '') {
            errors.number = 'Visa number is required';
        } else if (!/^[A-Za-z0-9]+$/.test(currentForm.number.trim())) {
            errors.number = 'Visa number must be alphanumeric with no special characters';
        }

        // 2. Issue Date - Required, valid date, must be past date
        if (!currentForm.issueDate || currentForm.issueDate.trim() === '') {
            errors.issueDate = 'Issue date is required';
        } else {
            const dateValidation = validateDate(currentForm.issueDate, true);
            if (!dateValidation.isValid) {
                errors.issueDate = dateValidation.error;
            } else {
                const issueDate = new Date(currentForm.issueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (issueDate >= today) {
                    errors.issueDate = 'Issue date must be a past date';
                }
            }
        }

        // 3. Expiry Date - Required, valid date, must be future date, must be after issue date
        if (!currentForm.expiryDate || currentForm.expiryDate.trim() === '') {
            errors.expiryDate = 'Expiry date is required';
        } else {
            const dateValidation = validateDate(currentForm.expiryDate, true);
            if (!dateValidation.isValid) {
                errors.expiryDate = dateValidation.error;
            } else {
                const expiryDate = new Date(currentForm.expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (expiryDate <= today) {
                    errors.expiryDate = 'Expiry date must be a future date';
                } else if (currentForm.issueDate) {
                    const issueDate = new Date(currentForm.issueDate);
                    if (expiryDate <= issueDate) {
                        errors.expiryDate = 'Expiry date must be later than the issue date';
                    }
                }
            }
        }

        // 4. Sponsor - Required (for employment and spouse visas), valid text (letters, numbers, spaces)
        if (type === 'employment' || type === 'spouse') {
            if (!currentForm.sponsor || currentForm.sponsor.trim() === '') {
                errors.sponsor = 'Sponsor is required';
            } else {
                const trimmedSponsor = currentForm.sponsor.trim();
                if (trimmedSponsor.length < 2) {
                    errors.sponsor = 'Sponsor must be at least 2 characters';
                } else if (!/^[A-Za-z0-9\s]+$/.test(trimmedSponsor)) {
                    errors.sponsor = 'Sponsor must contain only letters, numbers, and spaces';
                }
            }
        }

        // 5. Visa Copy Upload - Required, only PDF, JPEG, or PNG
        if (!currentForm.fileBase64 && !currentForm.file) {
            errors.file = 'Visa copy is required';
        } else if (currentForm.file) {
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
            const fileExtension = '.' + currentForm.file.name.split('.').pop().toLowerCase();

            if (!allowedTypes.includes(currentForm.file.type) && !allowedExtensions.includes(fileExtension)) {
                errors.file = 'Only PDF, JPEG, or PNG file formats are allowed';
            }
        } else if (currentForm.fileName) {
            // Check existing file extension
            const fileExtension = '.' + currentForm.fileName.split('.').pop().toLowerCase();
            const allowedExtensions = ['.pdf', '.jpeg', '.jpg', '.png'];
            if (!allowedExtensions.includes(fileExtension)) {
                errors.file = 'Only PDF, JPEG, or PNG file formats are allowed';
            }
        }

        setVisaErrors(prev => ({
            ...prev,
            [type]: errors
        }));

        return Object.keys(errors).length === 0;
    };

    const handleVisaSubmit = async () => {
        if (!selectedVisaType) {
            setAlertDialog({
                open: true,
                title: "Select Visa Type",
                description: "Please choose a visa type from the dropdown before saving."
            });
            return;
        }

        if (!validateVisaForm(selectedVisaType)) {
            setAlertDialog({
                open: true,
                title: "Missing Details",
                description: "Please fill all required visa fields before saving."
            });
            return;
        }

        const formData = visaForms[selectedVisaType];

        try {
            setSavingVisa(true);
            await axiosInstance.patch(`/Employee/visa/${employeeId}`, {
                visaType: selectedVisaType,
                visaNumber: formData.number,
                issueDate: formData.issueDate,
                expiryDate: formData.expiryDate,
                sponsor: formData.sponsor,
                visaCopy: formData.fileBase64,
                visaCopyName: formData.file?.name || formData.fileName || '',
                visaCopyMime: formData.file?.type || formData.fileMime || ''
            });

            setAlertDialog({
                open: true,
                title: "Visa Saved",
                description: `${visaTypes.find(type => type.key === selectedVisaType)?.label || 'Visa'} details have been saved successfully.`
            });
            setVisaErrors(prev => ({ ...prev, [selectedVisaType]: {} }));
            await fetchEmployee();
            setShowVisaModal(false);
            setSelectedVisaType('');
        } catch (error) {
            console.error('Failed to save visa details:', error);
            setAlertDialog({
                open: true,
                title: "Visa Save Failed",
                description: error.message || "Unable to update visa details. Please try again."
            });
        } finally {
            setSavingVisa(false);
        }
    };

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

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, updatePayload);
            await fetchEmployee();
            setShowEditModal(false);
            setEditFormErrors({});
            setAlertDialog({
                open: true,
                title: "Basic details updated",
                description: "Changes were saved successfully."
            });
        } catch (error) {
            console.error('Failed to update employee', error);
            setAlertDialog({
                open: true,
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

    useEffect(() => {
        if (employeeId) {
            fetchEmployee();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId]);

    useEffect(() => {
        setEducationDetails(employee?.educationDetails || []);
        setExperienceDetails(employee?.experienceDetails || []);
    }, [employee]);


    useEffect(() => {
        const fetchReportingAuthorities = async () => {
            try {
                setReportingAuthorityLoading(true);
                setReportingAuthorityError('');
                const response = await axiosInstance.get('/Employee');
                const employees = Array.isArray(response.data?.employees) ? response.data.employees : [];
                const options = employees
                    .filter((emp) => emp._id !== employeeId)
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
        };

        fetchReportingAuthorities();
    }, [employeeId]);

    const fetchEmployee = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await axiosInstance.get(`/Employee/${employeeId}`, {
                timeout: 60000 // 60 seconds timeout for employee detail fetch (may include large data)
            });
            let data = response.data?.employee || response.data;

            // Check and auto-update probation status if period has ended
            if (data && data.status === 'Probation' && data.dateOfJoining && data.probationPeriod) {
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
                        // Refetch to get updated data
                        const updatedResponse = await axiosInstance.get(`/Employee/${employeeId}`, {
                            timeout: 60000 // 60 seconds timeout for employee detail fetch
                        });
                        data = updatedResponse.data?.employee || updatedResponse.data;
                    } catch (updateErr) {
                        console.error('Error auto-updating probation status:', updateErr);
                        // Continue with original data if update fails
                    }
                }
            } else if (data && data.status === 'Probation' && data.dateOfJoining && !data.probationPeriod) {
                // Set default 6 months if not set
                try {
                    await axiosInstance.patch(`/Employee/work-details/${employeeId}`, {
                        probationPeriod: 6
                    });
                    // Refetch to get updated data
                    const updatedResponse = await axiosInstance.get(`/Employee/${employeeId}`, {
                        timeout: 60000 // 60 seconds timeout for employee detail fetch
                    });
                    data = updatedResponse.data?.employee || updatedResponse.data;
                } catch (updateErr) {
                    console.error('Error setting default probation period:', updateErr);
                    // Continue with original data if update fails
                }
            }

            setEmployee(data);
            if (data?.visaDetails) {
                setVisaForms(prev => {
                    const updated = { ...prev };
                    visaTypes.forEach(({ key }) => {
                        const details = data.visaDetails?.[key];
                        if (details) {
                            updated[key] = {
                                number: details.number || '',
                                issueDate: details.issueDate ? details.issueDate.substring(0, 10) : '',
                                expiryDate: details.expiryDate ? details.expiryDate.substring(0, 10) : '',
                                sponsor: details.sponsor || '',
                                file: null,
                                fileBase64: details.document?.data || '',
                                fileName: details.document?.name || '',
                                fileMime: details.document?.mimeType || ''
                            };
                        }
                    });
                    return updated;
                });
            }
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
        }
    };

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
            {
                value: (() => {
                    if (!employee?.reportingAuthority) return null;
                    if (typeof employee.reportingAuthority === 'object' && employee.reportingAuthority !== null) {
                        return `${employee.reportingAuthority.firstName || ''} ${employee.reportingAuthority.lastName || ''}`.trim() || employee.reportingAuthority.employeeId || null;
                    }
                    const match = reportingAuthorityOptions.find(opt => opt.value === employee.reportingAuthority);
                    return match?.label || employee.reportingAuthority || null;
                })(),
                name: 'Reporting To'
            },
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
            { value: getStateName(employee.country, employee.state), name: 'Emirates/State' },
            { value: employee.postalCode, name: 'Postal Code' }
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
            { value: getStateName(employee.currentCountry, employee.currentState), name: 'Emirates/State' },
            { value: employee.currentPostalCode, name: 'Postal Code' }
        ];
        currentAddressFields.forEach(({ value, name }) => {
            totalFields++;
            if (checkField(value, name, 'Current Address')) completedFields++;
        });

        // Emergency Contact (at least one with name and number)
        const contacts = getExistingContacts();
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

            setAlertDialog({
                open: true,
                title: "Profile Picture Updated",
                description: "Your profile picture has been updated successfully."
            });
        } catch (err) {
            console.error('Error uploading image:', err);
            setError(err.response?.data?.message || err.message || 'Failed to upload image');
            setAlertDialog({
                open: true,
                title: "Upload Failed",
                description: err.response?.data?.message || err.message || 'Failed to upload image. Please try again.'
            });
        } finally {
            setUploading(false);
        }
    };

    const tenure = calculateTenure(employee?.dateOfJoining);
    const profileCompletionData = calculateProfileCompletion();
    const profileCompletion = profileCompletionData.percentage;
    const pendingFields = profileCompletionData.pendingFields;
    const isProfileReady = profileCompletion >= 100;
    const approvalStatus = employee?.profileApprovalStatus || 'draft';
    const awaitingApproval = approvalStatus === 'submitted';
    const profileApproved = approvalStatus === 'active';
    const canSendForApproval = approvalStatus === 'draft' && isProfileReady;

    // Calculate visa expiry days from visaDetails (check all visa types and find earliest expiry)
    // Only calculate for non-UAE nationals
    let visaDays = null;
    if (!isUAENationality() && employee?.visaDetails) {
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
    const eidDays = employee?.eidExp ? calculateDaysUntilExpiry(employee.eidExp) : null;
    const medDays = employee?.medExp ? calculateDaysUntilExpiry(employee.medExp) : null;

    // Calculate Passport expiry days (only if it exists)
    const passportDays = employee?.passportDetails?.expiryDate ? calculateDaysUntilExpiry(employee.passportDetails.expiryDate) : null;

    // Calculate Labour Card expiry days (only if it exists)
    const labourCardDays = employee?.labourCardDetails?.expiryDate ? calculateDaysUntilExpiry(employee.labourCardDetails.expiryDate) : null;

    const isVisaRequirementApplicable = !isUAENationality();

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

    const InfoRow = ({ label, value }) => (
        <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</span>
            <span className="text-sm text-gray-900">{value || '—'}</span>
        </div>
    );

    return (
        <div className="flex min-h-screen" style={{ backgroundColor: '#F2F6F9' }}>
            <Sidebar />
            <div className="flex-1 flex flex-col">
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
                                    setShowAddMoreModal={setShowAddMoreModal}
                                    hasDocuments={(() => {
                                        // Check if any documents exist (manually added or attachments)
                                        if (employee?.documents && employee.documents.length > 0) return true;
                                        if (employee?.passportDetails?.document?.data) return true;
                                        if (employee?.visaDetails?.visit?.document?.data || employee?.visaDetails?.employment?.document?.data || employee?.visaDetails?.spouse?.document?.data) return true;
                                        if (employee?.emiratesIdDetails?.document?.data) return true;
                                        if (employee?.labourCardDetails?.document?.data) return true;
                                        if (employee?.medicalInsuranceDetails?.document?.data) return true;
                                        if (employee?.drivingLicenceDetails?.document?.data) return true;
                                        if (employee?.bankAttachment?.data) return true;
                                        if (employee?.offerLetter?.data) return true;
                                        if (employee?.salaryHistory && Array.isArray(employee.salaryHistory) && employee.salaryHistory.some(entry => entry.offerLetter?.data)) return true;
                                        if (employee?.educationDetails && Array.isArray(employee.educationDetails) && employee.educationDetails.some(edu => edu.certificate?.data)) return true;
                                        if (employee?.experienceDetails && Array.isArray(employee.experienceDetails) && employee.experienceDetails.some(exp => exp.certificate?.data)) return true;
                                        if (employee?.trainingDetails && Array.isArray(employee.trainingDetails) && employee.trainingDetails.some(training => training.certificate?.data)) return true;
                                        return false;
                                    })()}
                                    hasTraining={employee?.trainingDetails && employee.trainingDetails.length > 0}
                                    onTrainingClick={() => setShowTrainingModal(true)}
                                    onDocumentsClick={() => setShowDocumentModal(true)}
                                />

                                {/* Tab Content */}
                                <div className="p-6">
                                    {activeTab === 'basic' && (
                                        <div>
                                            {/* Sub-tabs for Basic Details */}
                                            <div className="flex gap-3 mb-6">
                                                <button
                                                    onClick={() => setActiveSubTab('basic-details')}
                                                    className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors border ${activeSubTab === 'basic-details'
                                                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                        : 'bg-transparent text-gray-500 border-gray-300 hover:text-gray-700'
                                                        }`}
                                                >
                                                    Basic Details
                                                </button>
                                                <button
                                                    onClick={() => setActiveSubTab('education')}
                                                    className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors border ${activeSubTab === 'education'
                                                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                        : 'bg-transparent text-gray-500 border-gray-300 hover:text-gray-700'
                                                        }`}
                                                >
                                                    Education
                                                </button>
                                                <button
                                                    onClick={() => setActiveSubTab('experience')}
                                                    className={`px-6 py-2 text-sm font-semibold rounded-md transition-colors border ${activeSubTab === 'experience'
                                                        ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                        : 'bg-transparent text-gray-500 border-gray-300 hover:text-gray-700'
                                                        }`}
                                                >
                                                    Experience
                                                </button>
                                            </div>

                                            {activeSubTab === 'basic-details' && (
                                                <div className="space-y-6">
                                                    {/* Masonry-style Column Flow Layout */}
                                                    <div className="columns-1 lg:columns-2 gap-6 space-y-0">
                                                        {/* Basic Details Card - Show only if permission isActive is true */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_basic', 'isActive')) && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Basic Details</h3>
                                                                    {(isAdmin() || hasPermission('hrm_employees_view_basic', 'isEdit')) && (
                                                                        <button
                                                                            onClick={openEditModal}
                                                                            className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                            title="Edit"
                                                                        >
                                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Employee ID', value: employee.employeeId },
                                                                        { label: 'Email', value: employee.email || employee.workEmail },
                                                                        { label: 'Contact Number', value: employee.contactNumber },
                                                                        {
                                                                            label: 'Date of Birth',
                                                                            value: employee.dateOfBirth ? (() => {
                                                                                const date = new Date(employee.dateOfBirth);
                                                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                                                const day = String(date.getDate()).padStart(2, '0');
                                                                                const year = date.getFullYear();
                                                                                return `${month}/${day}/${year}`;
                                                                            })() : null
                                                                        },
                                                                        {
                                                                            label: 'Marital Status',
                                                                            value: employee.maritalStatus
                                                                                ? employee.maritalStatus.charAt(0).toUpperCase() + employee.maritalStatus.slice(1)
                                                                                : null
                                                                        },
                                                                        ...(employee.maritalStatus === 'married' && employee.numberOfDependents ? [
                                                                            { label: 'Number of Dependents', value: String(employee.numberOfDependents) }
                                                                        ] : []),
                                                                        { label: "Father's Name", value: employee.fathersName },
                                                                        {
                                                                            label: 'Gender',
                                                                            value: employee.gender
                                                                                ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1)
                                                                                : null
                                                                        },
                                                                        { label: 'Nationality', value: getCountryName(employee.nationality || employee.country) }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Passport Card - Show only if permission isActive is true AND data exists */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_passport', 'isActive')) && employee.passportDetails?.number && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Passport</h3>
                                                                    <div className="flex items-center gap-2">
                                                                        {(isAdmin() || hasPermission('hrm_employees_view_passport', 'isEdit')) && employee.passportDetails?.number && (
                                                                            <button
                                                                                onClick={handleOpenPassportModal}
                                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                        {employee.passportDetails?.document?.data && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.passportDetails.document.data,
                                                                                        name: employee.passportDetails.document.name || 'Passport.pdf',
                                                                                        mimeType: employee.passportDetails.document.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Number', value: employee.passportDetails.number },
                                                                        { label: 'Issue date', value: employee.passportDetails.issueDate ? formatDate(employee.passportDetails.issueDate) : null },
                                                                        { label: 'Place of issue', value: employee.passportDetails.placeOfIssue ? getCountryName(employee.passportDetails.placeOfIssue) : employee.passportDetails.placeOfIssue },
                                                                        { label: 'Expiry date', value: employee.passportDetails.expiryDate ? formatDate(employee.passportDetails.expiryDate) : null }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Visa Card - Show only if permission isActive is true AND data exists and nationality is not UAE */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_visa', 'isActive')) && !isUAENationality() && (employee.visaDetails?.visit?.number ||
                                                            employee.visaDetails?.employment?.number ||
                                                            employee.visaDetails?.spouse?.number) && (
                                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                        <h3 className="text-xl font-semibold text-gray-800">Visa</h3>
                                                                        <div className="flex items-center gap-2">
                                                                            {(isAdmin() || hasPermission('hrm_employees_view_visa', 'isEdit')) && (employee.visaDetails?.visit?.number || employee.visaDetails?.employment?.number || employee.visaDetails?.spouse?.number) && (
                                                                                <button
                                                                                    onClick={() => handleOpenVisaModal()}
                                                                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                    title="Edit"
                                                                                >
                                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                    </svg>
                                                                                </button>
                                                                            )}
                                                                            {(employee.visaDetails?.visit?.document?.data || employee.visaDetails?.employment?.document?.data || employee.visaDetails?.spouse?.document?.data) && (
                                                                                <button
                                                                                    onClick={() => {
                                                                                        // Show the first available visa document
                                                                                        const visitDoc = employee.visaDetails?.visit?.document;
                                                                                        const employmentDoc = employee.visaDetails?.employment?.document;
                                                                                        const spouseDoc = employee.visaDetails?.spouse?.document;

                                                                                        const doc = visitDoc?.data ? visitDoc : (employmentDoc?.data ? employmentDoc : (spouseDoc?.data ? spouseDoc : null));

                                                                                        if (doc) {
                                                                                            setViewingDocument({
                                                                                                data: doc.data,
                                                                                                name: doc.name || 'Visa Document.pdf',
                                                                                                mimeType: doc.mimeType || 'application/pdf'
                                                                                            });
                                                                                            setShowDocumentViewer(true);
                                                                                        }
                                                                                    }}
                                                                                    className="text-green-600 hover:text-green-700 transition-colors"
                                                                                    title="Download"
                                                                                >
                                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                    </svg>
                                                                                </button>
                                                                            )}
                                                                            {showVisaDropdown && (
                                                                                <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                                                                                    {visaTypes.map((type) => (
                                                                                        <button
                                                                                            key={type.key}
                                                                                            onClick={() => handleOpenVisaModal(type.key)}
                                                                                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                                                                        >
                                                                                            {type.label}
                                                                                        </button>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        {/* Visit Visa */}
                                                                        {employee.visaDetails?.visit?.number && (
                                                                            <>
                                                                                {[
                                                                                    { label: 'Number', value: employee.visaDetails.visit.number },
                                                                                    { label: 'Issue date', value: employee.visaDetails.visit.issueDate ? formatDate(employee.visaDetails.visit.issueDate) : null },
                                                                                    { label: 'Date of Expiry', value: employee.visaDetails.visit.expiryDate ? formatDate(employee.visaDetails.visit.expiryDate) : null },
                                                                                    { label: 'Sponsor', value: employee.visaDetails.visit.sponsor }
                                                                                ]
                                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                                    .map((row, index, arr) => (
                                                                                        <div
                                                                                            key={row.label}
                                                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                                        >
                                                                                            <span className="text-gray-500">{row.label}</span>
                                                                                            <span className="text-gray-500">{row.value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </>
                                                                        )}

                                                                        {/* Employment Visa */}
                                                                        {employee.visaDetails?.employment?.number && (
                                                                            <>
                                                                                {employee.visaDetails?.visit?.number && <div className="border-t border-gray-200"></div>}
                                                                                {[
                                                                                    { label: 'Number', value: employee.visaDetails.employment.number },
                                                                                    { label: 'Issue date', value: employee.visaDetails.employment.issueDate ? formatDate(employee.visaDetails.employment.issueDate) : null },
                                                                                    { label: 'Date of Expiry', value: employee.visaDetails.employment.expiryDate ? formatDate(employee.visaDetails.employment.expiryDate) : null },
                                                                                    { label: 'Sponsor', value: employee.visaDetails.employment.sponsor }
                                                                                ]
                                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                                    .map((row, index, arr) => (
                                                                                        <div
                                                                                            key={row.label}
                                                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                                        >
                                                                                            <span className="text-gray-500">{row.label}</span>
                                                                                            <span className="text-gray-500">{row.value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </>
                                                                        )}

                                                                        {/* Spouse Visa */}
                                                                        {employee.visaDetails?.spouse?.number && (
                                                                            <>
                                                                                {(employee.visaDetails?.visit?.number || employee.visaDetails?.employment?.number) && <div className="border-t border-gray-200"></div>}
                                                                                {[
                                                                                    { label: 'Number', value: employee.visaDetails.spouse.number },
                                                                                    { label: 'Issue date', value: employee.visaDetails.spouse.issueDate ? formatDate(employee.visaDetails.spouse.issueDate) : null },
                                                                                    { label: 'Date of Expiry', value: employee.visaDetails.spouse.expiryDate ? formatDate(employee.visaDetails.spouse.expiryDate) : null },
                                                                                    { label: 'Sponsor', value: employee.visaDetails.spouse.sponsor }
                                                                                ]
                                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                                    .map((row, index, arr) => (
                                                                                        <div
                                                                                            key={row.label}
                                                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                                        >
                                                                                            <span className="text-gray-500">{row.label}</span>
                                                                                            <span className="text-gray-500">{row.value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                        {/* Emirates ID Card - Show only if permission isActive is true AND data exists */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_emirates_id', 'isActive')) && employee.emiratesIdDetails?.number && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Emirates ID</h3>
                                                                    <div className="flex items-center gap-2">
                                                                        {(isAdmin() || hasPermission('hrm_employees_view_emirates_id', 'isEdit')) && employee.emiratesIdDetails?.number && (
                                                                            <button
                                                                                onClick={handleOpenEmiratesIdModal}
                                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                        {employee.emiratesIdDetails?.document?.data && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.emiratesIdDetails.document.data,
                                                                                        name: employee.emiratesIdDetails.document.name || 'Emirates ID.pdf',
                                                                                        mimeType: employee.emiratesIdDetails.document.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Number', value: employee.emiratesIdDetails.number },
                                                                        { label: 'Issue date', value: employee.emiratesIdDetails.issueDate ? formatDate(employee.emiratesIdDetails.issueDate) : null },
                                                                        { label: 'Expiry Date', value: employee.emiratesIdDetails.expiryDate ? formatDate(employee.emiratesIdDetails.expiryDate) : null },
                                                                        { label: 'Last Updated', value: employee.emiratesIdDetails.lastUpdated ? formatDate(employee.emiratesIdDetails.lastUpdated) : null }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Labour Card - Show only if permission isActive is true AND data exists */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_labour_card', 'isActive')) && employee.labourCardDetails?.number && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Labour Card</h3>
                                                                    <div className="flex items-center gap-2">
                                                                        {(isAdmin() || hasPermission('hrm_employees_view_labour_card', 'isEdit')) && employee.labourCardDetails?.number && (
                                                                            <button
                                                                                onClick={handleOpenLabourCardModal}
                                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                        {employee.labourCardDetails?.document?.data && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.labourCardDetails.document.data,
                                                                                        name: employee.labourCardDetails.document.name || 'Labour Card.pdf',
                                                                                        mimeType: employee.labourCardDetails.document.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Number', value: employee.labourCardDetails.number },
                                                                        { label: 'Issue date', value: employee.labourCardDetails.issueDate ? formatDate(employee.labourCardDetails.issueDate) : null },
                                                                        { label: 'Expiry Date', value: employee.labourCardDetails.expiryDate ? formatDate(employee.labourCardDetails.expiryDate) : null },
                                                                        { label: 'Last Updated', value: employee.labourCardDetails.lastUpdated ? formatDate(employee.labourCardDetails.lastUpdated) : null }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Medical Insurance Card - Show only if permission isActive is true AND data exists */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_medical_insurance', 'isActive')) && employee.medicalInsuranceDetails?.provider && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Medical Insurance</h3>
                                                                    <div className="flex items-center gap-2">
                                                                        {(isAdmin() || hasPermission('hrm_employees_view_medical_insurance', 'isEdit')) && employee.medicalInsuranceDetails?.provider && (
                                                                            <button
                                                                                onClick={handleOpenMedicalInsuranceModal}
                                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                        {employee.medicalInsuranceDetails?.document?.data && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.medicalInsuranceDetails.document.data,
                                                                                        name: employee.medicalInsuranceDetails.document.name || 'Medical Insurance.pdf',
                                                                                        mimeType: employee.medicalInsuranceDetails.document.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Provider', value: employee.medicalInsuranceDetails.provider },
                                                                        { label: 'Number', value: employee.medicalInsuranceDetails.number },
                                                                        { label: 'Issue date', value: employee.medicalInsuranceDetails.issueDate ? formatDate(employee.medicalInsuranceDetails.issueDate) : null },
                                                                        { label: 'Expiry Date', value: employee.medicalInsuranceDetails.expiryDate ? formatDate(employee.medicalInsuranceDetails.expiryDate) : null },
                                                                        { label: 'Last Updated', value: employee.medicalInsuranceDetails.lastUpdated ? formatDate(employee.medicalInsuranceDetails.lastUpdated) : null }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Driving License Card - Show only if permission isActive is true AND data exists */}
                                                        {(isAdmin() || hasPermission('hrm_employees_view_driving_license', 'isActive')) && employee.drivingLicenceDetails?.number && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Driving Licences</h3>
                                                                    <div className="flex items-center gap-2">
                                                                        {(isAdmin() || hasPermission('hrm_employees_view_driving_license', 'isEdit')) && employee.drivingLicenceDetails?.number && (
                                                                            <button
                                                                                onClick={handleOpenDrivingLicenseModal}
                                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                        {employee.drivingLicenceDetails?.document?.data && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.drivingLicenceDetails.document.data,
                                                                                        name: employee.drivingLicenceDetails.document.name || 'Driving License.pdf',
                                                                                        mimeType: employee.drivingLicenceDetails.document.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Number', value: employee.drivingLicenceDetails.number },
                                                                        { label: 'Issue date', value: employee.drivingLicenceDetails.issueDate ? formatDate(employee.drivingLicenceDetails.issueDate) : null },
                                                                        { label: 'Expiry Date', value: employee.drivingLicenceDetails.expiryDate ? formatDate(employee.drivingLicenceDetails.expiryDate) : null },
                                                                        { label: 'Last Updated', value: employee.drivingLicenceDetails.lastUpdated ? formatDate(employee.drivingLicenceDetails.lastUpdated) : null }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Add More Button */}
                                                    <div className="mt-6">
                                                        <button
                                                            onClick={() => setShowAddMoreModal(true)}
                                                            className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                        >
                                                            Add More
                                                            <span className="text-lg leading-none">+</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {activeSubTab === 'education' && (
                                                <div className="space-y-6">
                                                    {/* Education Details - Show only if permission isActive is true */}
                                                    {(isAdmin() || hasPermission('hrm_employees_view_education', 'isActive')) && (
                                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="text-xl font-semibold text-gray-800">Education Details</h3>
                                                                {(isAdmin() || hasPermission('hrm_employees_view_education', 'isCreate')) && (
                                                                    <button
                                                                        onClick={handleOpenEducationModal}
                                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                                    >
                                                                        Add Education
                                                                        <span className="text-lg leading-none">+</span>
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="overflow-x-auto">
                                                                <table className="w-full">
                                                                    <thead>
                                                                        <tr className="border-b border-gray-200">
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">University / Board</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">College / Institute</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Course</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Field of Study</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Completed Year</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Certificate</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {educationDetails && educationDetails.length > 0 ? (
                                                                            educationDetails.map((education) => {
                                                                                const educationId = education._id || education.id;
                                                                                return (
                                                                                    <tr key={educationId} className="border-b border-gray-100 hover:bg-gray-50">
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.universityOrBoard || education.university || education.board || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.collegeOrInstitute || education.college || education.institute || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.course || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.fieldOfStudy || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{education.completedYear || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                                                            {education.certificate?.name ? (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setViewingDocument({
                                                                                                            data: education.certificate.data || '',
                                                                                                            name: education.certificate.name || '',
                                                                                                            mimeType: education.certificate.mimeType || ''
                                                                                                        });
                                                                                                        setShowDocumentViewer(true);
                                                                                                    }}
                                                                                                    className="text-blue-600 hover:text-blue-700 underline"
                                                                                                >
                                                                                                    {education.certificate.name}
                                                                                                </button>
                                                                                            ) : (
                                                                                                '—'
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-sm">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <button
                                                                                                    onClick={() => handleEditEducation(education)}
                                                                                                    className="text-blue-600 hover:text-blue-700"
                                                                                                    disabled={deletingEducationId === educationId}
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                                    </svg>
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => handleDeleteEducation(educationId)}
                                                                                                    className="text-red-600 hover:text-red-700"
                                                                                                    disabled={deletingEducationId === educationId}
                                                                                                >
                                                                                                    {deletingEducationId === educationId ? (
                                                                                                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                        </svg>
                                                                                                    ) : (
                                                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                                                        </svg>
                                                                                                    )}
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={7} className="py-16 text-center text-gray-400 text-sm">
                                                                                    No education details available
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {activeSubTab === 'experience' && (
                                                <div className="space-y-6">
                                                    {/* Experience Details - Show only if permission isActive is true */}
                                                    {(isAdmin() || hasPermission('hrm_employees_view_experience', 'isActive')) && (
                                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="text-xl font-semibold text-gray-800">Experience Details</h3>
                                                                {(isAdmin() || hasPermission('hrm_employees_view_experience', 'isCreate')) && (
                                                                    <button
                                                                        onClick={handleOpenExperienceModal}
                                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                                    >
                                                                        Add Experience
                                                                        <span className="text-lg leading-none">+</span>
                                                                    </button>
                                                                )}
                                                            </div>

                                                            <div className="overflow-x-auto">
                                                                <table className="w-full">
                                                                    <thead>
                                                                        <tr className="border-b border-gray-200">
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Company</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Designation</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Start Date</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">End Date</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Certificate</th>
                                                                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {experienceDetails && experienceDetails.length > 0 ? (
                                                                            experienceDetails.map((experience) => {
                                                                                const experienceId = experience._id || experience.id;
                                                                                return (
                                                                                    <tr key={experienceId} className="border-b border-gray-100 hover:bg-gray-50">
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{experience.company || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{experience.designation || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                                                            {experience.startDate ? (typeof experience.startDate === 'string' ? formatDate(experience.startDate) : formatDate(experience.startDate)) : '—'}
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                                                            {experience.endDate ? (typeof experience.endDate === 'string' ? formatDate(experience.endDate) : formatDate(experience.endDate)) : '—'}
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                                                            {experience.certificate?.name ? (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setViewingDocument({
                                                                                                            data: experience.certificate.data || '',
                                                                                                            name: experience.certificate.name || '',
                                                                                                            mimeType: experience.certificate.mimeType || ''
                                                                                                        });
                                                                                                        setShowDocumentViewer(true);
                                                                                                    }}
                                                                                                    className="text-blue-600 hover:text-blue-700 underline"
                                                                                                >
                                                                                                    {experience.certificate.name}
                                                                                                </button>
                                                                                            ) : (
                                                                                                '—'
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-sm">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <button
                                                                                                    onClick={() => handleEditExperience(experience)}
                                                                                                    className="text-blue-600 hover:text-blue-700"
                                                                                                    disabled={deletingExperienceId === experienceId}
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                                    </svg>
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => handleDeleteExperience(experienceId)}
                                                                                                    className="text-red-600 hover:text-red-700"
                                                                                                    disabled={deletingExperienceId === experienceId}
                                                                                                >
                                                                                                    {deletingExperienceId === experienceId ? (
                                                                                                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                        </svg>
                                                                                                    ) : (
                                                                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                                                        </svg>
                                                                                                    )}
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
                                                                                    No experience details available
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'work-details' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                {/* Work Details Card - Show only if permission isActive is true */}
                                                {(isAdmin() || hasPermission('hrm_employees_view_work', 'isActive')) && (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Work Details</h3>
                                                            {(isAdmin() || hasPermission('hrm_employees_view_work', 'isEdit')) && (
                                                                <button
                                                                    onClick={openWorkDetailsModal}
                                                                    className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                    title="Edit"
                                                                >
                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div>
                                                            {[
                                                                { label: 'Date of Joining', value: employee.dateOfJoining ? formatDate(employee.dateOfJoining) : null, show: !!employee.dateOfJoining },
                                                                { label: 'Role', value: employee.role, show: !!employee.role },
                                                                { label: 'Department', value: employee.department ? departmentOptions.find(opt => opt.value === employee.department)?.label || employee.department : null, show: !!employee.department },
                                                                { label: 'Designation', value: employee.designation, show: !!employee.designation },
                                                                {
                                                                    label: 'Work Status',
                                                                    value: (() => {
                                                                        if (!employee.status) return null;
                                                                        if (employee.status !== 'Probation' || !employee.probationPeriod) {
                                                                            return employee.status;
                                                                        }
                                                                        return `${employee.status} (${employee.probationPeriod} Month${employee.probationPeriod > 1 ? 's' : ''})`;
                                                                    })(),
                                                                    show: !!employee.status
                                                                },
                                                                { label: 'Probation Period', value: employee.probationPeriod ? `${employee.probationPeriod} Month${employee.probationPeriod > 1 ? 's' : ''}` : null, show: !!employee.probationPeriod },
                                                                { label: 'Overtime', value: employee.overtime !== undefined ? (employee.overtime ? 'Yes' : 'No') : null, show: employee.overtime !== undefined },
                                                                {
                                                                    label: 'Reporting To',
                                                                    value: (() => {
                                                                        if (!employee?.reportingAuthority) return null;
                                                                        // Handle populated object
                                                                        if (typeof employee.reportingAuthority === 'object' && employee.reportingAuthority !== null) {
                                                                            return `${employee.reportingAuthority.firstName || ''} ${employee.reportingAuthority.lastName || ''}`.trim() || employee.reportingAuthority.employeeId || '—';
                                                                        }
                                                                        // Handle string/ID
                                                                        return reportingAuthorityValueForDisplay;
                                                                    })(),
                                                                    show: !!employee?.reportingAuthority
                                                                },
                                                                {
                                                                    label: 'Primary Reportee',
                                                                    value: (() => {
                                                                        if (!employee?.primaryReportee) return null;
                                                                        // Handle populated object
                                                                        if (typeof employee.primaryReportee === 'object' && employee.primaryReportee !== null) {
                                                                            return `${employee.primaryReportee.firstName || ''} ${employee.primaryReportee.lastName || ''}`.trim() || employee.primaryReportee.employeeId || '—';
                                                                        }
                                                                        // Handle string/ID
                                                                        const match = reportingAuthorityOptions.find(opt => opt.value === employee.primaryReportee);
                                                                        return match?.label || employee.primaryReportee || null;
                                                                    })(),
                                                                    show: !!employee?.primaryReportee
                                                                },
                                                                {
                                                                    label: 'Secondary Reportee',
                                                                    value: (() => {
                                                                        if (!employee?.secondaryReportee) return null;
                                                                        // Handle populated object
                                                                        if (typeof employee.secondaryReportee === 'object' && employee.secondaryReportee !== null) {
                                                                            return `${employee.secondaryReportee.firstName || ''} ${employee.secondaryReportee.lastName || ''}`.trim() || employee.secondaryReportee.employeeId || '—';
                                                                        }
                                                                        // Handle string/ID
                                                                        const match = reportingAuthorityOptions.find(opt => opt.value === employee.secondaryReportee);
                                                                        return match?.label || employee.secondaryReportee || null;
                                                                    })(),
                                                                    show: !!employee?.secondaryReportee
                                                                }
                                                            ]
                                                                .filter(row => row.show && row.value !== null && row.value !== undefined && row.value !== '')
                                                                .map((row, index, arr) => (
                                                                    <div
                                                                        key={row.label}
                                                                        className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                    >
                                                                        <span className="text-gray-500">{row.label}</span>
                                                                        <span className="text-gray-500">{row.value}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'salary' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                {/* Salary Details Card - Show only if permission isActive is true */}
                                                {(isAdmin() || hasPermission('hrm_employees_view_salary', 'isActive')) && (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Salary Details</h3>
                                                            <div className="flex items-center gap-2">
                                                                {hasSalaryDetails() ? (
                                                                    (isAdmin() || hasPermission('hrm_employees_view_salary', 'isEdit')) && (
                                                                        <button
                                                                            onClick={handleOpenSalaryModal}
                                                                            className="text-blue-600 hover:text-blue-700"
                                                                            title="Edit"
                                                                        >
                                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                            </svg>
                                                                        </button>
                                                                    )
                                                                ) : (
                                                                    (isAdmin() || hasPermission('hrm_employees_view_salary', 'isCreate')) && (
                                                                        <button
                                                                            onClick={handleOpenSalaryModal}
                                                                            className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                                                                        >
                                                                            Add Salary
                                                                            <span className="text-sm leading-none">+</span>
                                                                        </button>
                                                                    )
                                                                )}
                                                                {(() => {
                                                                    // Check for offer letter in latest salary history or main employee
                                                                    let offerLetter = null;
                                                                    if (employee?.salaryHistory && Array.isArray(employee.salaryHistory) && employee.salaryHistory.length > 0) {
                                                                        // Use history as-is (no sorting), latest entries are at the top
                                                                        const sortedHistory = [...employee.salaryHistory];
                                                                        for (const entry of sortedHistory) {
                                                                            if (entry.offerLetter?.data) {
                                                                                offerLetter = entry.offerLetter;
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                    if (!offerLetter && employee?.offerLetter?.data) {
                                                                        offerLetter = employee.offerLetter;
                                                                    }
                                                                    return offerLetter ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                setViewingDocument({
                                                                                    data: offerLetter.data,
                                                                                    name: offerLetter.name || 'Offer Letter.pdf',
                                                                                    mimeType: offerLetter.mimeType || 'application/pdf'
                                                                                });
                                                                                setShowDocumentViewer(true);
                                                                            }}
                                                                            className="text-green-600 hover:text-green-700 transition-colors"
                                                                            title="Download Offer Letter"
                                                                        >
                                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                            </svg>
                                                                        </button>
                                                                    ) : null;
                                                                })()}
                                                            </div>
                                                        </div>
                                                        <div>
                                                            {[
                                                                { label: 'Basic Salary', value: employee.basic ? `AED ${employee.basic.toFixed(2)}` : 'AED 0.00' },
                                                                { label: 'Home Rent Allowance', value: employee.houseRentAllowance ? `AED ${employee.houseRentAllowance.toFixed(1)}` : 'AED 0.0' },
                                                                {
                                                                    label: 'Vehicle Allowance',
                                                                    value: employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount
                                                                        ? `AED ${employee.additionalAllowances.find(a => a.type?.toLowerCase().includes('vehicle')).amount.toFixed(2)}`
                                                                        : 'AED 0.00'
                                                                },
                                                                {
                                                                    label: 'Fuel Allowance',
                                                                    value: employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount
                                                                        ? `AED ${employee.additionalAllowances.find(a => a.type?.toLowerCase().includes('fuel')).amount.toFixed(2)}`
                                                                        : 'AED 0.00'
                                                                },
                                                                { label: 'Other Allowance', value: employee.otherAllowance ? `AED ${employee.otherAllowance.toFixed(2)}` : 'AED 0.00' },
                                                                {
                                                                    label: 'Total Salary',
                                                                    value: (() => {
                                                                        const basic = employee.basic || 0;
                                                                        const hra = employee.houseRentAllowance || 0;
                                                                        const other = employee.otherAllowance || 0;
                                                                        const vehicle = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
                                                                        const fuel = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                                                                        // Calculate other additional allowances (excluding vehicle and fuel)
                                                                        const otherAdditional = (employee.additionalAllowances || [])
                                                                            .filter(item => !item.type?.toLowerCase().includes('vehicle') && !item.type?.toLowerCase().includes('fuel'))
                                                                            .reduce((sum, item) => sum + (item.amount || 0), 0);
                                                                        const total = basic + hra + other + vehicle + fuel + otherAdditional;
                                                                        return `AED ${total.toFixed(2)}`;
                                                                    })(),
                                                                    isTotal: true
                                                                }
                                                            ]
                                                                .map((row, index, arr) => (
                                                                    <div
                                                                        key={row.label}
                                                                        className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''} ${row.isTotal ? 'bg-gray-50 font-semibold' : ''}`}
                                                                    >
                                                                        <span className="text-gray-500">{row.label}</span>
                                                                        <span className="text-gray-500">{row.value}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Salary Bank Account Card or Add Button - Show only if permission isActive is true */}
                                                {(isAdmin() || hasPermission('hrm_employees_view_bank', 'isActive')) && (
                                                    <>
                                                        {hasBankDetailsSection() ? (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Salary Bank Account</h3>
                                                                    <div className="flex items-center gap-2">
                                                                        {(isAdmin() || hasPermission('hrm_employees_view_bank', 'isEdit')) && (
                                                                            <button
                                                                                onClick={handleOpenBankModal}
                                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                        {employee.bankAttachment?.data && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.bankAttachment.data,
                                                                                        name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                                                                        mimeType: employee.bankAttachment.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 transition-colors"
                                                                                title="Download"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    {[
                                                                        { label: 'Bank Name', value: employee.bankName || employee.bank },
                                                                        { label: 'Account Name', value: employee.accountName || employee.bankAccountName },
                                                                        { label: 'Account Number', value: employee.accountNumber || employee.bankAccountNumber },
                                                                        { label: 'IBAN Number', value: employee.ibanNumber },
                                                                        { label: 'SWIFT Code', value: employee.swiftCode || employee.ifscCode || employee.ifsc },
                                                                        { label: 'Other Details (if any)', value: employee.bankOtherDetails || employee.otherBankDetails }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="text-gray-500">{row.label}</span>
                                                                                <span className="text-gray-500">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                                {employee.bankAttachment?.data && (
                                                                    <div className="px-6 py-3 border-t border-gray-100">
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="text-sm text-gray-500">Bank Attachment</span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setViewingDocument({
                                                                                        data: employee.bankAttachment.data,
                                                                                        name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                                                                        mimeType: employee.bankAttachment.mimeType || 'application/pdf'
                                                                                    });
                                                                                    setShowDocumentViewer(true);
                                                                                }}
                                                                                className="text-green-600 hover:text-green-700 flex items-center gap-2"
                                                                                title="Download Bank Attachment"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                    <polyline points="7 10 12 15 17 10"></polyline>
                                                                                    <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                </svg>
                                                                                <span className="text-sm font-medium">Download</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex justify-start">
                                                                {(isAdmin() || hasPermission('hrm_employees_view_bank', 'isCreate')) && (
                                                                    <button
                                                                        onClick={handleOpenBankModal}
                                                                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                                                                    >
                                                                        Add Bank Account
                                                                        <span className="text-sm leading-none">+</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            {/* Action Buttons - Tab Style */}
                                            <div className="flex flex-wrap gap-3 mt-6">
                                                {['Salary History', 'Fine', 'Rewards', 'NCR', 'Loans', 'CTC'].map((action) => (
                                                    <button
                                                        key={action}
                                                        onClick={() => {
                                                            setSelectedSalaryAction(action);
                                                            setSalaryHistoryPage(1); // Reset to first page when switching actions
                                                        }}
                                                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors border-2 ${selectedSalaryAction === action
                                                            ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600'
                                                            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
                                                            }`}
                                                    >
                                                        {action}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Salary Action Card */}
                                            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                                {(() => {
                                                    // Prepare salary history data - display all entries from history
                                                    // The initial salary should already be in the history array
                                                    let salaryHistoryData = employee?.salaryHistory || [];

                                                    // Only add initial salary if it truly doesn't exist in history AND employee has basic/otherAllowance
                                                    // This is a fallback for employees created before the history tracking was implemented
                                                    if (employee && (employee.basic || employee.otherAllowance) && salaryHistoryData.length === 0) {
                                                        // Only add if there's no history at all (legacy employee)
                                                        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                                                        const dateOfJoining = employee.dateOfJoining ? new Date(employee.dateOfJoining) : (employee.createdAt ? new Date(employee.createdAt) : new Date());
                                                        const month = monthNames[dateOfJoining.getMonth()];
                                                        const firstDayOfMonth = new Date(dateOfJoining.getFullYear(), dateOfJoining.getMonth(), 1);
                                                        const initialBasic = employee.basic || 0;
                                                        const initialOther = employee.otherAllowance || 0;
                                                        const initialHRA = employee.houseRentAllowance || 0;
                                                        const initialVehicle = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
                                                        const initialFuel = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                                                        const initialTotal = initialBasic + initialOther + initialHRA + initialVehicle + initialFuel;

                                                        const initialSalaryEntry = {
                                                            month: month,
                                                            fromDate: firstDayOfMonth,
                                                            toDate: null,
                                                            basic: initialBasic,
                                                            houseRentAllowance: initialHRA,
                                                            vehicleAllowance: initialVehicle,
                                                            fuelAllowance: initialFuel,
                                                            otherAllowance: initialOther,
                                                            totalSalary: initialTotal,
                                                            createdAt: dateOfJoining,
                                                            isInitial: true
                                                        };

                                                        salaryHistoryData = [initialSalaryEntry];
                                                    }

                                                    // Display salary history in insertion order (latest first, no sorting)
                                                    const sortedHistory = selectedSalaryAction === 'Salary History'
                                                        ? [...salaryHistoryData] // Use array as-is, new entries are already at the top
                                                        : [];
                                                    const totalItems = sortedHistory.length;
                                                    const totalPages = Math.max(1, Math.ceil(totalItems / salaryHistoryItemsPerPage));
                                                    const startIndex = (salaryHistoryPage - 1) * salaryHistoryItemsPerPage;
                                                    const endIndex = startIndex + salaryHistoryItemsPerPage;
                                                    const currentPageData = sortedHistory.slice(startIndex, endIndex);

                                                    const formatDate = (date) => {
                                                        if (!date) return '—';
                                                        const d = new Date(date);
                                                        return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
                                                    };

                                                    // Generate page numbers to display based on total pages
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
                                                        <>
                                                            <div className="flex items-center justify-between mb-4">
                                                                <h3 className="text-xl font-semibold text-gray-800">{selectedSalaryAction}</h3>
                                                                <div className="flex items-center gap-4">
                                                                    {selectedSalaryAction !== 'Salary History' && (
                                                                        <button
                                                                            onClick={() => {
                                                                                console.log(`Add ${selectedSalaryAction}`);
                                                                            }}
                                                                            className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                                        >
                                                                            Add {selectedSalaryAction === 'Rewards' ? 'Reward' : selectedSalaryAction.slice(0, -1)}
                                                                            <span className="text-lg leading-none">+</span>
                                                                        </button>
                                                                    )}
                                                                    {selectedSalaryAction === 'Salary History' && (
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

                                                            <div className="overflow-x-auto">
                                                                <table className="w-full">
                                                                    <thead>
                                                                        <tr className="border-b border-gray-200">
                                                                            {selectedSalaryAction === 'Salary History' && (
                                                                                <>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">From Date</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">To Date</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic Salary</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Other Allowance</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Home Rent Allowance</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vehicle Allowance</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fuel Allowance</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Salary</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Offer Letter</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                                                                                </>
                                                                            )}
                                                                            {selectedSalaryAction === 'Rewards' && (
                                                                                <>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                                                                </>
                                                                            )}
                                                                            {selectedSalaryAction === 'Fine' && (
                                                                                <>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Description</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
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
                                                                            {selectedSalaryAction === 'Loans' && (
                                                                                <>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Installment</th>
                                                                                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Balance</th>
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
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {selectedSalaryAction === 'Salary History' && currentPageData.length > 0 ? (
                                                                            currentPageData.map((entry, index) => {
                                                                                const actualIndex = startIndex + index;
                                                                                return (
                                                                                    <tr key={actualIndex} className="border-b border-gray-100 hover:bg-gray-50">
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{entry.month || '—'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{formatDate(entry.fromDate)}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">{formatDate(entry.toDate)}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">AED {entry.basic?.toFixed(2) || '0.00'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">AED {entry.otherAllowance?.toFixed(2) || '0.00'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">AED {entry.houseRentAllowance?.toFixed(2) || '0.00'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">AED {entry.vehicleAllowance?.toFixed(2) || '0.00'}</td>
                                                                                        <td className="py-3 px-4 text-sm text-gray-500">AED {(() => {
                                                                                            // Extract fuel allowance from entry or additionalAllowances for backward compatibility
                                                                                            if (entry.fuelAllowance !== undefined && entry.fuelAllowance !== null) {
                                                                                                return entry.fuelAllowance.toFixed(2);
                                                                                            }
                                                                                            const fuelFromAdditional = entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0;
                                                                                            return fuelFromAdditional.toFixed(2);
                                                                                        })()}</td>
                                                                                        <td className="py-3 px-4 text-sm font-semibold text-gray-500">AED {(() => {
                                                                                            // Recalculate total to ensure it includes fuel allowance
                                                                                            const basic = entry.basic || 0;
                                                                                            const hra = entry.houseRentAllowance || 0;
                                                                                            const vehicle = entry.vehicleAllowance || 0;
                                                                                            const other = entry.otherAllowance || 0;
                                                                                            // Get fuel from entry or additionalAllowances
                                                                                            const fuel = entry.fuelAllowance !== undefined && entry.fuelAllowance !== null
                                                                                                ? entry.fuelAllowance
                                                                                                : (entry.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);
                                                                                            const recalculatedTotal = basic + hra + vehicle + fuel + other;
                                                                                            return recalculatedTotal.toFixed(2);
                                                                                        })()}</td>
                                                                                        <td className="py-3 px-4 text-sm">
                                                                                            {entry.offerLetter?.data ? (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setViewingDocument({
                                                                                                            data: entry.offerLetter.data,
                                                                                                            name: entry.offerLetter.name || 'Offer Letter.pdf',
                                                                                                            mimeType: entry.offerLetter.mimeType || 'application/pdf'
                                                                                                        });
                                                                                                        setShowDocumentViewer(true);
                                                                                                    }}
                                                                                                    className="text-green-600 hover:text-green-700"
                                                                                                    title="View Offer Letter"
                                                                                                >
                                                                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                                                    </svg>
                                                                                                </button>
                                                                                            ) : (
                                                                                                <span className="text-gray-400">—</span>
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="py-3 px-4 text-sm">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        const entryToEdit = sortedHistory[actualIndex];
                                                                                                        setEditingSalaryIndex(actualIndex);
                                                                                                        // Extract fuel allowance from entry or additionalAllowances for backward compatibility
                                                                                                        const entryFuelAllowance = entryToEdit.fuelAllowance !== undefined && entryToEdit.fuelAllowance !== null
                                                                                                            ? entryToEdit.fuelAllowance
                                                                                                            : (entryToEdit.additionalAllowances?.find(a => a.type?.toLowerCase().includes('fuel'))?.amount || 0);

                                                                                                        setSalaryForm({
                                                                                                            month: entryToEdit.month || '',
                                                                                                            fromDate: entryToEdit.fromDate ? new Date(entryToEdit.fromDate).toISOString().split('T')[0] : '',
                                                                                                            basic: entryToEdit.basic ? String(entryToEdit.basic) : '',
                                                                                                            houseRentAllowance: entryToEdit.houseRentAllowance ? String(entryToEdit.houseRentAllowance) : '',
                                                                                                            vehicleAllowance: entryToEdit.vehicleAllowance ? String(entryToEdit.vehicleAllowance) : '',
                                                                                                            fuelAllowance: entryFuelAllowance ? String(entryFuelAllowance) : '',
                                                                                                            otherAllowance: entryToEdit.otherAllowance ? String(entryToEdit.otherAllowance) : '',
                                                                                                            totalSalary: entryToEdit.totalSalary ? String(entryToEdit.totalSalary) : calculateTotalSalary(
                                                                                                                entryToEdit.basic ? String(entryToEdit.basic) : '',
                                                                                                                entryToEdit.houseRentAllowance ? String(entryToEdit.houseRentAllowance) : '',
                                                                                                                entryToEdit.vehicleAllowance ? String(entryToEdit.vehicleAllowance) : '',
                                                                                                                entryFuelAllowance ? String(entryFuelAllowance) : '',
                                                                                                                entryToEdit.otherAllowance ? String(entryToEdit.otherAllowance) : ''
                                                                                                            ),
                                                                                                            offerLetterFile: null,
                                                                                                            offerLetterFileBase64: entryToEdit.offerLetter?.data || '',
                                                                                                            offerLetterFileName: entryToEdit.offerLetter?.name || '',
                                                                                                            offerLetterFileMime: entryToEdit.offerLetter?.mimeType || ''
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
                                                                                                    className="text-blue-600 hover:text-blue-700"
                                                                                                    title="Edit"
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                                    </svg>
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={async () => {
                                                                                                        if (confirm('Are you sure you want to delete this salary record?')) {
                                                                                                            try {
                                                                                                                const updatedHistory = sortedHistory.filter((_, i) => i !== actualIndex);
                                                                                                                await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                                                                                                                    salaryHistory: updatedHistory
                                                                                                                });
                                                                                                                await fetchEmployee();
                                                                                                                setAlertDialog({
                                                                                                                    open: true,
                                                                                                                    title: "Salary record deleted",
                                                                                                                    description: "Salary record was deleted successfully."
                                                                                                                });
                                                                                                            } catch (error) {
                                                                                                                console.error('Failed to delete salary record', error);
                                                                                                                setAlertDialog({
                                                                                                                    open: true,
                                                                                                                    title: "Delete failed",
                                                                                                                    description: error.response?.data?.message || error.message || "Something went wrong."
                                                                                                                });
                                                                                                            }
                                                                                                        }
                                                                                                    }}
                                                                                                    className="text-red-600 hover:text-red-700"
                                                                                                    title="Delete"
                                                                                                >
                                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                                                    </svg>
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>
                                                                                );
                                                                            })
                                                                        ) : selectedSalaryAction === 'Salary History' ? (
                                                                            <tr>
                                                                                <td colSpan={9} className="py-16 text-center text-gray-400 text-sm">
                                                                                    No Salary History
                                                                                </td>
                                                                            </tr>
                                                                        ) : (
                                                                            <tr>
                                                                                <td colSpan={4} className="py-16 text-center text-gray-400 text-sm">
                                                                                    No {selectedSalaryAction} data available
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                        </div>
                                    )}

                                    {activeTab === 'personal' && (
                                        <div className="space-y-6">
                                            <div className="columns-1 lg:columns-2 gap-6 space-y-0">
                                                {/* Personal Details Card */}
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                        <h3 className="text-xl font-semibold text-gray-800">Personal Details</h3>
                                                        <button
                                                            onClick={handleOpenPersonalModal}
                                                            className="text-blue-600 hover:text-blue-700"
                                                        >
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    <div>
                                                        {[
                                                            { label: 'Email Address', value: employee.email || employee.workEmail },
                                                            { label: 'Contact Number', value: employee.contactNumber },
                                                            {
                                                                label: 'Date of Birth',
                                                                value: employee.dateOfBirth ? formatDate(employee.dateOfBirth) : null
                                                            },
                                                            {
                                                                label: 'Marital Status',
                                                                value: employee.maritalStatus
                                                                    ? employee.maritalStatus.charAt(0).toUpperCase() + employee.maritalStatus.slice(1)
                                                                    : null
                                                            },
                                                            ...(employee.maritalStatus === 'married' && employee.numberOfDependents ? [{ label: 'Number of Dependents', value: String(employee.numberOfDependents) }] : []),
                                                            { label: 'Father\'s Name', value: employee.fathersName },
                                                            {
                                                                label: 'Gender',
                                                                value: employee.gender
                                                                    ? employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1)
                                                                    : null
                                                            },
                                                            {
                                                                label: 'Nationality',
                                                                value: employee.nationality || employee.country
                                                                    ? getCountryName(employee.nationality || employee.country)
                                                                    : null
                                                            }
                                                        ]
                                                            .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                            .map((row, index, arr) => (
                                                                <div
                                                                    key={row.label}
                                                                    className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                >
                                                                    <span className="text-gray-500">{row.label}</span>
                                                                    <span className="text-gray-500">{row.value}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* Permanent Address Card */}
                                                {hasPermanentAddress ? (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Permanent Address</h3>
                                                            <button
                                                                onClick={() => handleOpenAddressModal('permanent')}
                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div>
                                                            {[
                                                                { label: 'Address', value: employee.addressLine1 },
                                                                { label: 'Apartment/Flat', value: employee.addressLine2 },
                                                                { label: 'City', value: employee.city },
                                                                { label: 'Emirates/State', value: getStateName(employee.country, employee.state) },
                                                                { label: 'Country', value: getCountryName(employee.country) },
                                                                { label: 'ZIP Code', value: employee.postalCode }
                                                            ]
                                                                .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                .map((row, index, arr) => (
                                                                    <div
                                                                        key={row.label}
                                                                        className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                    >
                                                                        <span className="text-gray-500">{row.label}</span>
                                                                        <span className="text-gray-500">{row.value}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Current Address Card */}
                                                {hasCurrentAddress ? (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Current Address</h3>
                                                            <button
                                                                onClick={() => handleOpenAddressModal('current')}
                                                                className="text-blue-600 hover:text-blue-700 transition-colors"
                                                                title="Edit"
                                                            >
                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                        <div>
                                                            {[
                                                                { label: 'Address', value: employee.currentAddressLine1 },
                                                                { label: 'Apartment/Flat', value: employee.currentAddressLine2 },
                                                                { label: 'City', value: employee.currentCity },
                                                                { label: 'Emirates/State', value: getStateName(employee.currentCountry, employee.currentState) },
                                                                { label: 'Country', value: getCountryName(employee.currentCountry) },
                                                                { label: 'ZIP Code', value: employee.currentPostalCode }
                                                            ]
                                                                .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                .map((row, index, arr) => (
                                                                    <div
                                                                        key={row.label}
                                                                        className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                    >
                                                                        <span className="text-gray-500">{row.label}</span>
                                                                        <span className="text-gray-500">{row.value}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Emergency Contact Card - Show only if permission isActive is true AND data exists */}
                                                {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isActive')) && hasContactDetails && (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 break-inside-avoid mb-6">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Emergency Contact</h3>
                                                            {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isCreate')) && (
                                                                <button
                                                                    onClick={() => handleOpenContactModal()}
                                                                    className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                                >
                                                                    Add Emergency Contact
                                                                    <span className="text-base leading-none">+</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div>
                                                            {(() => {
                                                                const contacts = getExistingContacts();
                                                                return contacts.map((contact, contactIndex) => {
                                                                    const contactFields = [
                                                                        { label: 'Contact', value: `Contact ${contactIndex + 1}`, isHeader: true },
                                                                        { label: 'Relation', value: contact.relation ? contact.relation.charAt(0).toUpperCase() + contact.relation.slice(1) : 'Self' },
                                                                        { label: 'Name', value: contact.name },
                                                                        { label: 'Phone Number', value: contact.number }
                                                                    ].filter(field => field.value && field.value.trim() !== '');

                                                                    return contactFields.map((field, fieldIndex, arr) => (
                                                                        <div
                                                                            key={`${contact.id || contactIndex}-${field.label}`}
                                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${fieldIndex !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                        >
                                                                            {field.isHeader ? (
                                                                                <>
                                                                                    <span className="text-gray-800 font-semibold">{field.value}</span>
                                                                                    <div className="flex items-center gap-3">
                                                                                        {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isEdit')) && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleOpenContactModal(contact.id, contact.index);
                                                                                                }}
                                                                                                className="text-blue-600 hover:text-blue-700"
                                                                                                title="Edit Contact"
                                                                                            >
                                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                                </svg>
                                                                                            </button>
                                                                                        )}
                                                                                        {(isAdmin() || hasPermission('hrm_employees_view_emergency', 'isDelete')) && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleDeleteContact(contact.id, contact.index);
                                                                                                }}
                                                                                                disabled={deletingContactId === (contact.id || `legacy-${contact.index}`)}
                                                                                                className="text-red-500 hover:text-red-600 text-xs font-semibold disabled:opacity-60"
                                                                                            >
                                                                                                {deletingContactId === (contact.id || `legacy-${contact.index}`) ? 'Removing...' : 'Remove'}
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <span className="text-gray-500">{field.label}</span>
                                                                                    <span className="text-gray-500">{field.value}</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    ));
                                                                }).flat();
                                                            })()}
                                                        </div>
                                                    </div>
                                                )}

                                            </div>

                                            {/* Action Buttons - Outside the cards */}
                                            <div className="flex flex-wrap gap-4 mt-6">
                                                {(!hasContactDetails || !hasCurrentAddress || !hasPermanentAddress) && (
                                                    <button
                                                        onClick={() => setShowAddMoreModal(true)}
                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                    >
                                                        Add More
                                                        <span className="text-lg leading-none">+</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'documents' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-2xl font-semibold text-gray-800">Documents</h2>
                                                {(isAdmin() || hasPermission('hrm_employees_view_documents', 'isCreate')) && (
                                                    <button
                                                        onClick={() => {
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
                                                        className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                                                    >
                                                        <span>+</span> Add Document
                                                    </button>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-gray-50 border-b border-gray-200">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                                                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Files</th>
                                                            {(isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit')) && (
                                                                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                                            )}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {(() => {
                                                            // Collect all documents and attachments
                                                            const allDocuments = [];

                                                            // Add manually added documents
                                                            if (employee?.documents && employee.documents.length > 0) {
                                                                employee.documents.forEach((doc, idx) => {
                                                                    allDocuments.push({
                                                                        type: doc.type || 'Document',
                                                                        document: doc.document,
                                                                        source: 'manual',
                                                                        index: idx
                                                                    });
                                                                });
                                                            }

                                                            // Add Passport
                                                            if (employee?.passportDetails?.document?.data) {
                                                                allDocuments.push({
                                                                    type: 'Passport',
                                                                    description: `Passport Number: ${employee.passportDetails.number || 'N/A'}`,
                                                                    document: employee.passportDetails.document,
                                                                    source: 'passport'
                                                                });
                                                            }

                                                            // Add Visa documents
                                                            if (employee?.visaDetails) {
                                                                if (employee.visaDetails.visit?.document?.data) {
                                                                    allDocuments.push({
                                                                        type: 'Visit Visa',
                                                                        description: `Visa Number: ${employee.visaDetails.visit.number || 'N/A'}`,
                                                                        document: employee.visaDetails.visit.document,
                                                                        source: 'visa-visit'
                                                                    });
                                                                }
                                                                if (employee.visaDetails.employment?.document?.data) {
                                                                    allDocuments.push({
                                                                        type: 'Employment Visa',
                                                                        description: `Visa Number: ${employee.visaDetails.employment.number || 'N/A'}`,
                                                                        document: employee.visaDetails.employment.document,
                                                                        source: 'visa-employment'
                                                                    });
                                                                }
                                                                if (employee.visaDetails.spouse?.document?.data) {
                                                                    allDocuments.push({
                                                                        type: 'Spouse Visa',
                                                                        description: `Visa Number: ${employee.visaDetails.spouse.number || 'N/A'}`,
                                                                        document: employee.visaDetails.spouse.document,
                                                                        source: 'visa-spouse'
                                                                    });
                                                                }
                                                            }

                                                            // Add Emirates ID
                                                            if (employee?.emiratesIdDetails?.document?.data) {
                                                                allDocuments.push({
                                                                    type: 'Emirates ID',
                                                                    description: `Emirates ID Number: ${employee.emiratesIdDetails.number || 'N/A'}`,
                                                                    document: employee.emiratesIdDetails.document,
                                                                    source: 'emirates-id'
                                                                });
                                                            }

                                                            // Add Labour Card
                                                            if (employee?.labourCardDetails?.document?.data) {
                                                                allDocuments.push({
                                                                    type: 'Labour Card',
                                                                    description: `Labour Card Number: ${employee.labourCardDetails.number || 'N/A'}`,
                                                                    document: employee.labourCardDetails.document,
                                                                    source: 'labour-card'
                                                                });
                                                            }

                                                            // Add Medical Insurance
                                                            if (employee?.medicalInsuranceDetails?.document?.data) {
                                                                allDocuments.push({
                                                                    type: 'Medical Insurance',
                                                                    description: `Provider: ${employee.medicalInsuranceDetails.provider || 'N/A'}, Policy: ${employee.medicalInsuranceDetails.number || 'N/A'}`,
                                                                    document: employee.medicalInsuranceDetails.document,
                                                                    source: 'medical-insurance'
                                                                });
                                                            }

                                                            // Add Driving License
                                                            if (employee?.drivingLicenceDetails?.document?.data) {
                                                                allDocuments.push({
                                                                    type: 'Driving License',
                                                                    description: `License Number: ${employee.drivingLicenceDetails.number || 'N/A'}`,
                                                                    document: employee.drivingLicenceDetails.document,
                                                                    source: 'driving-license'
                                                                });
                                                            }

                                                            // Add Bank Attachment
                                                            if (employee?.bankAttachment?.data) {
                                                                allDocuments.push({
                                                                    type: 'Bank Account Attachment',
                                                                    description: `Bank: ${employee.bankName || employee.bank || 'N/A'}`,
                                                                    document: employee.bankAttachment,
                                                                    source: 'bank'
                                                                });
                                                            }

                                                            // Add only the latest Offer Letter
                                                            // Priority: Latest salary history entry > Main salary offer letter
                                                            let latestOfferLetter = null;

                                                            // Check salary history first (most recent)
                                                            if (employee?.salaryHistory && Array.isArray(employee.salaryHistory)) {
                                                                // Sort by date if available, or use the last entry
                                                                // Use history as-is (no sorting), latest entries are at the top
                                                                const sortedHistory = [...employee.salaryHistory];

                                                                for (const entry of sortedHistory) {
                                                                    if (entry.offerLetter?.data) {
                                                                        latestOfferLetter = {
                                                                            type: 'Offer Letter',
                                                                            description: `Salary History - ${entry.month || 'N/A'} ${entry.year || ''}`,
                                                                            document: entry.offerLetter,
                                                                            source: 'salary-history-latest'
                                                                        };
                                                                        break;
                                                                    }
                                                                }
                                                            }

                                                            // If no history offer letter, use main salary offer letter
                                                            if (!latestOfferLetter && employee?.offerLetter?.data) {
                                                                latestOfferLetter = {
                                                                    type: 'Offer Letter',
                                                                    description: 'Current Salary Offer Letter',
                                                                    document: employee.offerLetter,
                                                                    source: 'salary-offer-letter'
                                                                };
                                                            }

                                                            if (latestOfferLetter) {
                                                                allDocuments.push(latestOfferLetter);
                                                            }

                                                            // Add Education Certificates
                                                            if (employee?.educationDetails && Array.isArray(employee.educationDetails)) {
                                                                employee.educationDetails.forEach((edu, idx) => {
                                                                    if (edu.certificate?.data) {
                                                                        allDocuments.push({
                                                                            type: 'Education Certificate',
                                                                            description: `${edu.course || 'Education'} - ${edu.universityOrBoard || 'N/A'}`,
                                                                            document: edu.certificate,
                                                                            source: `education-${idx}`
                                                                        });
                                                                    }
                                                                });
                                                            }

                                                            // Add Experience Certificates
                                                            if (employee?.experienceDetails && Array.isArray(employee.experienceDetails)) {
                                                                employee.experienceDetails.forEach((exp, idx) => {
                                                                    if (exp.certificate?.data) {
                                                                        allDocuments.push({
                                                                            type: 'Experience Certificate',
                                                                            description: `${exp.designation || 'Position'} at ${exp.company || 'N/A'}`,
                                                                            document: exp.certificate,
                                                                            source: `experience-${idx}`
                                                                        });
                                                                    }
                                                                });
                                                            }

                                                            // Add Training Certificates
                                                            if (employee?.trainingDetails && Array.isArray(employee.trainingDetails)) {
                                                                employee.trainingDetails.forEach((training, idx) => {
                                                                    if (training.certificate?.data) {
                                                                        allDocuments.push({
                                                                            type: 'Training Certificate',
                                                                            description: training.trainingName || 'Training',
                                                                            document: training.certificate,
                                                                            source: `training-${idx}`
                                                                        });
                                                                    }
                                                                });
                                                            }

                                                            return allDocuments.length > 0 ? (
                                                                <>
                                                                    {allDocuments.map((doc, index) => {
                                                                        const isEditable = doc.source === 'manual' && (isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit'));

                                                                        return (
                                                                            <tr key={index} className="hover:bg-gray-50">
                                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                                    <span className="text-sm font-medium text-gray-800">{doc.type || 'Document'}</span>
                                                                                </td>
                                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                                    {doc.document?.data ? (
                                                                                        <button
                                                                                            onClick={() => {
                                                                                                setViewingDocument({
                                                                                                    data: doc.document.data,
                                                                                                    name: doc.document.name || `${doc.type || 'Document'}.pdf`,
                                                                                                    mimeType: doc.document.mimeType || 'application/pdf'
                                                                                                });
                                                                                                setShowDocumentViewer(true);
                                                                                            }}
                                                                                            className="text-blue-600 hover:text-blue-800 underline text-sm font-medium"
                                                                                        >
                                                                                            {(() => {
                                                                                                const fileName = doc.document.name || `${doc.type || 'Document'}.pdf`;
                                                                                                const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
                                                                                                const ext = fileName.substring(fileName.lastIndexOf('.')) || '.PDF';
                                                                                                return `${nameWithoutExt.toUpperCase()}${ext.toUpperCase()}`;
                                                                                            })()}
                                                                                        </button>
                                                                                    ) : (
                                                                                        <span className="text-sm text-gray-400">No file</span>
                                                                                    )}
                                                                                </td>
                                                                                {isEditable && (
                                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <button
                                                                                                onClick={() => handleEditDocument(doc.index)}
                                                                                                className="text-blue-600 hover:text-blue-800 font-medium text-sm px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                                                                                                title="Edit Document"
                                                                                            >
                                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                                                </svg>
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDeleteDocument(doc.index)}
                                                                                                disabled={deletingDocumentIndex === doc.index}
                                                                                                className="text-red-600 hover:text-red-800 font-medium text-sm px-3 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                                                title="Delete Document"
                                                                                            >
                                                                                                {deletingDocumentIndex === doc.index ? (
                                                                                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                                                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                                    </svg>
                                                                                                ) : (
                                                                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                                    </svg>
                                                                                                )}
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                                {!isEditable && (isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit')) && (
                                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                                        <span className="text-sm text-gray-400">—</span>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </>
                                                            ) : (
                                                                <tr>
                                                                    <td colSpan={(isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit')) ? 3 : 2} className="px-6 py-12 text-center text-gray-400">
                                                                        No documents found
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })()}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'training' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-2xl font-semibold text-gray-800">Training Details</h2>
                                                {(isAdmin() || hasPermission('hrm_employees_view_training', 'isCreate')) && (
                                                    <button
                                                        onClick={() => {
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
                                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"
                                                    >
                                                        <span>+</span> Add Training
                                                    </button>
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                {employee?.trainingDetails && employee.trainingDetails.length > 0 ? (
                                                    employee.trainingDetails.map((training, index) => (
                                                        <div key={index} className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                <h3 className="text-xl font-semibold text-gray-800">{training.trainingName || 'Training'}</h3>
                                                                <div className="flex items-center gap-2">
                                                                    {training.certificate?.data && (
                                                                        <button
                                                                            onClick={() => {
                                                                                setViewingDocument({
                                                                                    data: training.certificate.data,
                                                                                    name: training.certificate.name || `${training.trainingName} Certificate.pdf`,
                                                                                    mimeType: training.certificate.mimeType || 'application/pdf'
                                                                                });
                                                                                setShowDocumentViewer(true);
                                                                            }}
                                                                            className="text-green-600 hover:text-green-700"
                                                                            title="View Certificate"
                                                                        >
                                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                    {(isAdmin() || hasPermission('hrm_employees_view_training', 'isEdit')) && (
                                                                        <button
                                                                            onClick={() => {
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
                                                                            className="text-blue-600 hover:text-blue-700"
                                                                            title="Edit"
                                                                        >
                                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                    {(isAdmin() || hasPermission('hrm_employees_view_training', 'isDelete')) && (
                                                                        <button
                                                                            onClick={async () => {
                                                                                if (confirm('Are you sure you want to delete this training record?')) {
                                                                                    try {
                                                                                        setDeletingTrainingIndex(index);
                                                                                        const updatedTraining = employee.trainingDetails.filter((_, i) => i !== index);
                                                                                        await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                                                                                            trainingDetails: updatedTraining
                                                                                        });
                                                                                        await fetchEmployee();
                                                                                        setAlertDialog({
                                                                                            open: true,
                                                                                            title: "Training deleted",
                                                                                            description: "Training record was deleted successfully."
                                                                                        });
                                                                                    } catch (error) {
                                                                                        console.error('Failed to delete training', error);
                                                                                        setAlertDialog({
                                                                                            open: true,
                                                                                            title: "Delete failed",
                                                                                            description: error.response?.data?.message || error.message || "Something went wrong."
                                                                                        });
                                                                                    } finally {
                                                                                        setDeletingTrainingIndex(null);
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="text-red-600 hover:text-red-700"
                                                                            title="Delete"
                                                                            disabled={deletingTrainingIndex === index}
                                                                        >
                                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                            </svg>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                {[
                                                                    { label: 'Details', value: training.trainingDetails },
                                                                    { label: 'From', value: training.trainingFrom },
                                                                    { label: 'Date', value: training.trainingDate ? formatDate(training.trainingDate) : null },
                                                                    { label: 'Cost', value: training.trainingCost ? `AED ${training.trainingCost.toFixed(2)}` : null }
                                                                ]
                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                    .map((row, rowIndex, arr) => (
                                                                        <div
                                                                            key={row.label}
                                                                            className={`flex items-center justify-between px-6 py-4 text-sm font-medium text-gray-600 ${rowIndex !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                        >
                                                                            <span className="text-gray-500">{row.label}</span>
                                                                            <span className="text-gray-500">{row.value}</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="col-span-full text-center py-12 text-gray-400">
                                                        No training records added yet
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Image Upload and Crop Modal */}
            {
                showImageModal && (
                    <>
                        <style jsx global>{`
                                input[type="range"].vertical-slider {
                                    -webkit-appearance: none;
                                    appearance: none;
                                    background: transparent;
                                }
                                input[type="range"].vertical-slider::-webkit-slider-runnable-track {
                                    width: 200px;
                                    height: 4px;
                                    background: #e5e7eb;
                                    border-radius: 4px;
                                }
                                input[type="range"].vertical-slider::-webkit-slider-thumb {
                                    -webkit-appearance: none;
                                    appearance: none;
                                    width: 16px;
                                    height: 16px;
                                    background: #3b82f6;
                                    border-radius: 50%;
                                    cursor: pointer;
                                    margin-top: -6px;
                                }
                                input[type="range"].vertical-slider::-moz-range-track {
                                    width: 200px;
                                    height: 4px;
                                    background: #e5e7eb;
                                    border-radius: 4px;
                                }
                                input[type="range"].vertical-slider::-moz-range-thumb {
                                    width: 16px;
                                    height: 16px;
                                    background: #3b82f6;
                                    border: none;
                                    border-radius: 50%;
                                    cursor: pointer;
                                }
                            `}</style>
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-semibold text-gray-800">Crop Profile Picture</h2>
                                        <button
                                            onClick={() => {
                                                if (!uploading) {
                                                    setShowImageModal(false);
                                                    setSelectedImage(null);
                                                    setImageScale(1);
                                                    setError('');
                                                }
                                            }}
                                            disabled={uploading}
                                            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    </div>

                                    {selectedImage && (
                                        <div className="flex gap-6 items-start">
                                            {/* Image Preview Area with AvatarEditor */}
                                            <div className="flex-1 flex justify-center">
                                                <div className="relative bg-gray-100 rounded-lg p-4" style={{ width: '500px', height: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <AvatarEditor
                                                        ref={avatarEditorRef}
                                                        image={selectedImage}
                                                        width={400}
                                                        height={400}
                                                        border={0}
                                                        borderRadius={200}
                                                        scale={imageScale}
                                                        rotate={0}
                                                        color={[0, 0, 0, 0.5]}
                                                        style={{ width: '100%', height: '100%' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Vertical Zoom Slider */}
                                            <div className="flex flex-col items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (imageScale < 3) {
                                                            const newScale = Math.min(3, imageScale + 0.1);
                                                            setImageScale(newScale);
                                                        }
                                                    }}
                                                    disabled={uploading || imageScale >= 3}
                                                    className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Zoom In"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>

                                                <div className="relative flex flex-col items-center">
                                                    <div
                                                        className="relative bg-gray-200 rounded-full"
                                                        style={{
                                                            height: '200px',
                                                            width: '4px',
                                                            position: 'relative'
                                                        }}
                                                    >
                                                        <input
                                                            type="range"
                                                            min="1"
                                                            max="3"
                                                            step="0.01"
                                                            value={imageScale}
                                                            onChange={(e) => {
                                                                const newScale = parseFloat(e.target.value);
                                                                setImageScale(newScale);
                                                            }}
                                                            disabled={uploading}
                                                            className="absolute vertical-slider cursor-pointer disabled:opacity-50"
                                                            style={{
                                                                width: '200px',
                                                                height: '4px',
                                                                transform: 'rotate(-90deg)',
                                                                transformOrigin: 'center',
                                                                left: '-98px',
                                                                top: '98px',
                                                                background: 'transparent'
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="mt-2 text-xs text-gray-600 font-medium">
                                                        {Math.round(imageScale * 100)}%
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        if (imageScale > 1) {
                                                            const newScale = Math.max(1, imageScale - 0.1);
                                                            setImageScale(newScale);
                                                        }
                                                    }}
                                                    disabled={uploading || imageScale <= 1}
                                                    className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Zoom Out"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                                    </svg>
                                                </button>
                                            </div>

                                            {/* Controls */}
                                            <div className="flex flex-col gap-4 w-48">
                                                {error && (
                                                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                                        {error}
                                                    </div>
                                                )}

                                                <div className="flex flex-col gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (!uploading) {
                                                                const input = document.createElement('input');
                                                                input.type = 'file';
                                                                input.accept = 'image/*';
                                                                input.onchange = handleFileSelect;
                                                                input.click();
                                                            }
                                                        }}
                                                        disabled={uploading}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Change Image
                                                    </button>
                                                    <button
                                                        onClick={handleUploadImage}
                                                        disabled={uploading || !selectedImage}
                                                        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {uploading ? 'Uploading...' : 'Save & Upload'}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )
            }

            {/* Edit Basic Details Modal - Only show when on Basic Details tab */}
            {
                showEditModal && activeTab === 'basic' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={() => {
                            if (!updating) {
                                setShowEditModal(false);
                                setEditFormErrors({});
                            }
                        }}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">Basic Details</h3>
                                <button
                                    onClick={() => {
                                        if (!updating) {
                                            setShowEditModal(false);
                                            setEditFormErrors({});
                                        }
                                    }}
                                    className="absolute right-0 text-gray-400 hover:text-gray-600"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 pr-2 max-h-[70vh] overflow-y-auto modal-scroll">
                                <div className="space-y-3">
                                    {[
                                        { label: 'Employee ID', field: 'employeeId', type: 'text', readOnly: true },
                                        { label: 'Email', field: 'email', type: 'email', required: true },
                                        { label: 'Contact Number', field: 'contactNumber', type: 'phone', required: true },
                                        { label: 'Date of Birth', field: 'dateOfBirth', type: 'date', required: true, placeholder: 'mm/dd/yyyy' },
                                        {
                                            label: 'Marital Status',
                                            field: 'maritalStatus',
                                            type: 'select',
                                            required: true,
                                            options: [
                                                { value: '', label: 'Select Marital Status' },
                                                { value: 'single', label: 'Single' },
                                                { value: 'married', label: 'Married' },
                                                { value: 'divorced', label: 'Divorced' },
                                                { value: 'widowed', label: 'Widowed' }
                                            ]
                                        },
                                        ...(editForm.maritalStatus === 'married' ? [
                                            { label: 'Number of Dependents', field: 'numberOfDependents', type: 'number', required: false, placeholder: 'Enter number of dependents' }
                                        ] : []),
                                        { label: 'Father\'s Name', field: 'fathersName', type: 'text', required: true },
                                        {
                                            label: 'Gender', field: 'gender', type: 'select', required: true, options: [
                                                { value: '', label: 'Select Gender' },
                                                { value: 'male', label: 'Male' },
                                                { value: 'female', label: 'Female' },
                                                { value: 'other', label: 'Other' }
                                            ]
                                        },
                                        {
                                            label: 'Nationality',
                                            field: 'nationality',
                                            type: 'select',
                                            required: true,
                                            options: [
                                                { value: '', label: 'Select Nationality' },
                                                ...getAllCountriesOptions()
                                            ]
                                        }
                                    ].map((input) => (
                                        <div key={input.field} className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {input.type === 'phone' ? (
                                                <div className="w-full md:flex-1">
                                                    <PhoneInput
                                                        country={DEFAULT_PHONE_COUNTRY}
                                                        value={editForm[input.field]}
                                                        onChange={(value, country) => handleEditChange(input.field, value, country)}
                                                        enableSearch
                                                        specialLabel=""
                                                        inputStyle={{
                                                            width: '100%',
                                                            height: '42px',
                                                            borderRadius: '0.75rem',
                                                            borderColor: editFormErrors[input.field] ? '#ef4444' : '#E5E7EB'
                                                        }}
                                                        buttonStyle={{
                                                            borderTopLeftRadius: '0.75rem',
                                                            borderBottomLeftRadius: '0.75rem',
                                                            borderColor: editFormErrors[input.field] ? '#ef4444' : '#E5E7EB',
                                                            backgroundColor: '#fff'
                                                        }}
                                                        dropdownStyle={{ borderRadius: '0.75rem' }}
                                                        placeholder="Enter contact number"
                                                        disabled={updating}
                                                    />
                                                    {editFormErrors[input.field] && (
                                                        <p className="text-xs text-red-500 mt-1">{editFormErrors[input.field]}</p>
                                                    )}
                                                </div>
                                            ) : input.type === 'select' ? (
                                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                                    <select
                                                        value={editForm[input.field]}
                                                        onChange={(e) => {
                                                            handleEditChange(input.field, e.target.value);
                                                            // Clear error when user selects
                                                            if (editFormErrors[input.field]) {
                                                                setEditFormErrors(prev => {
                                                                    const updated = { ...prev };
                                                                    delete updated[input.field];
                                                                    return updated;
                                                                });
                                                            }
                                                        }}
                                                        className={`w-full h-10 px-3 rounded-xl border ${editFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                        disabled={updating}
                                                    >
                                                        {input.options.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    {editFormErrors[input.field] && (
                                                        <p className="text-xs text-red-500 mt-1">{editFormErrors[input.field]}</p>
                                                    )}
                                                </div>
                                            ) : (
                                                <input
                                                    type={input.type}
                                                    value={editForm[input.field]}
                                                    onChange={(e) => {
                                                        let value = e.target.value;
                                                        // Restrict input based on field type
                                                        if (input.field === 'fathersName') {
                                                            // Only allow letters and spaces (no numbers or special characters)
                                                            value = value.replace(/[^A-Za-z\s]/g, '');
                                                        }
                                                        handleEditChange(input.field, value);
                                                    }}
                                                    onInput={(e) => {
                                                        // Additional real-time filtering for string fields
                                                        if (input.field === 'fathersName') {
                                                            // Only allow letters and spaces
                                                            e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                        }
                                                    }}
                                                    className={`w-full md:flex-1 h-10 px-3 rounded-xl border ${editFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                    disabled={updating || input.readOnly}
                                                    readOnly={input.readOnly}
                                                />
                                            )}
                                            {editFormErrors[input.field] && input.type !== 'phone' && (
                                                <p className="text-xs text-red-500 mt-1 w-full md:col-span-2">{editFormErrors[input.field]}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-4 px-4 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => {
                                        if (!updating) {
                                            setShowEditModal(false);
                                            setEditFormErrors({});
                                        }
                                    }}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors disabled:opacity-50"
                                    disabled={updating}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setConfirmUpdateOpen(true)}
                                    className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                    disabled={updating}
                                >
                                    {updating ? 'Updating...' : 'Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Confirm Update Dialog */}
            <AlertDialog open={confirmUpdateOpen} onOpenChange={(open) => !updating && setConfirmUpdateOpen(open)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Update basic details?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to save these changes to the employee&apos;s basic details?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={updating}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirmUpdateOpen(false);
                                handleUpdateEmployee();
                            }}
                            disabled={updating}
                        >
                            {updating ? 'Updating...' : 'Confirm'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Result Dialog */}
            <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((prev) => ({ ...prev, open }))}>
                <AlertDialogContent className="sm:max-w-[425px] rounded-[22px] border-gray-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-[22px] font-semibold text-gray-800">{alertDialog.title}</AlertDialogTitle>
                        <AlertDialogDescription className="text-sm text-[#6B6B6B] mt-2">
                            {alertDialog.description}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-4">
                        <AlertDialogAction
                            onClick={() => setAlertDialog((prev) => ({ ...prev, open: false }))}
                            className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors"
                        >
                            OK
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Work Details Modal */}
            <WorkDetailsModal
                isOpen={showWorkDetailsModal}
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

            {/* Passport Modal */}
            {
                showPassportModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleClosePassportModal}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">Passport Details</h3>
                                <button
                                    onClick={handleClosePassportModal}
                                    className="absolute right-0 text-gray-400 hover:text-gray-600"
                                    disabled={savingPassport}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                                <div className="flex flex-col gap-3">
                                    {passportFieldConfig.map((input) => (
                                        <div key={input.field} className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                                {input.type === 'select' ? (
                                                    <select
                                                        value={passportForm[input.field]}
                                                        onChange={(e) => {
                                                            handlePassportChange(input.field, e.target.value);
                                                            if (passportErrors[input.field]) {
                                                                setPassportErrors(prev => ({ ...prev, [input.field]: '' }));
                                                            }
                                                        }}
                                                        className={`w-full h-10 px-3 rounded-xl border ${passportErrors[input.field] ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                        disabled={savingPassport}
                                                    >
                                                        <option value="">Select {input.label}</option>
                                                        {input.options?.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={input.type}
                                                        value={passportForm[input.field]}
                                                        onChange={(e) => {
                                                            handlePassportChange(input.field, e.target.value);
                                                            if (passportErrors[input.field]) {
                                                                setPassportErrors(prev => ({ ...prev, [input.field]: '' }));
                                                            }
                                                        }}
                                                        className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${passportErrors[input.field] ? 'ring-2 ring-red-400 border-red-400' : ''
                                                            }`}
                                                        disabled={savingPassport || input.readOnly}
                                                        readOnly={input.readOnly}
                                                    />
                                                )}
                                                {passportErrors[input.field] && (
                                                    <p className="text-xs text-red-500">{passportErrors[input.field]}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            Passport Copy <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-2">
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".jpeg,.jpg,.pdf"
                                                onChange={handlePassportFileChange}
                                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${passportErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''
                                                    }`}
                                                disabled={savingPassport}
                                            />
                                            {passportErrors.file && (
                                                <p className="text-xs text-red-500">{passportErrors.file}</p>
                                            )}
                                            {passportForm.file && (
                                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                    <div className="flex items-center gap-2">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 6L9 17l-5-5"></path>
                                                        </svg>
                                                        <span>{passportForm.file.name}</span>
                                                    </div>
                                                    {employee?.passportDetails?.document?.data && (
                                                        <button
                                                            onClick={() => {
                                                                setViewingDocument({
                                                                    data: employee.passportDetails.document.data,
                                                                    name: employee.passportDetails.document.name || 'Passport Document',
                                                                    mimeType: employee.passportDetails.document.mimeType || 'application/pdf'
                                                                });
                                                                setShowDocumentViewer(true);
                                                            }}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {passportScanError && (
                                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                                    <p className="text-xs text-red-600">{passportScanError}</p>
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-500">Upload file in JPEG / PDF format.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                                <button
                                    onClick={handleClosePassportModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                    disabled={savingPassport}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePassportSubmit}
                                    className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                    disabled={savingPassport}
                                >
                                    {savingPassport ? 'Updating...' : 'Update'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Visa Modal */}
            {
                showVisaModal && selectedVisaType && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleCloseVisaModal}></div>
                        <div className="relative w-full max-w-4xl bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] max-h-[80vh] flex flex-col">
                            <div className="flex flex-col gap-2 border-b border-gray-200 p-6 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <h3 className="text-2xl font-semibold text-gray-800">Visa Requirements</h3>
                                    <p className="text-sm text-gray-500">
                                        {selectedVisaLabel ? `${selectedVisaLabel} details` : 'Upload visa details'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleCloseVisaModal}
                                    disabled={savingVisa}
                                    className={`text-gray-400 hover:text-gray-600 self-start md:self-auto ${savingVisa ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="space-y-3">
                                    {[
                                        { label: 'Visa Number', field: 'number', type: 'text', required: true },
                                        { label: 'Issue Date', field: 'issueDate', type: 'date', required: true },
                                        { label: 'Expiry Date', field: 'expiryDate', type: 'date', required: true },
                                        ...(selectedVisaType === 'employment' || selectedVisaType === 'spouse'
                                            ? [{ label: 'Sponsor (Company / Individual)', field: 'sponsor', type: 'text', required: true }]
                                            : []),
                                        { label: 'Visa Copy Upload', field: 'file', type: 'file', required: true }
                                    ].map((input) => (
                                        <div key={`${selectedVisaType}-${input.field}`} className="flex flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                                {input.type === 'file' ? (
                                                    <input
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        onChange={(e) => handleVisaFileChange(selectedVisaType, e.target.files?.[0] || null)}
                                                        className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${visaErrors[selectedVisaType]?.file ? 'ring-2 ring-red-400 border-red-400' : ''
                                                            }`}
                                                        disabled={savingVisa}
                                                    />
                                                ) : (
                                                    <input
                                                        type={input.type}
                                                        value={visaForms[selectedVisaType]?.[input.field] || ''}
                                                        onChange={(e) => {
                                                            let value = e.target.value;
                                                            // Apply input restrictions
                                                            if (input.field === 'number') {
                                                                // Only alphanumeric, no special characters
                                                                value = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                                            } else if (input.field === 'sponsor') {
                                                                // Only letters, numbers, and spaces
                                                                value = value.replace(/[^A-Za-z0-9\s]/g, '');
                                                            }
                                                            handleVisaFieldChange(selectedVisaType, input.field, value);
                                                        }}
                                                        onInput={(e) => {
                                                            // Additional real-time filtering
                                                            if (input.field === 'number') {
                                                                e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                                            } else if (input.field === 'sponsor') {
                                                                e.target.value = e.target.value.replace(/[^A-Za-z0-9\s]/g, '');
                                                            }
                                                        }}
                                                        className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${visaErrors[selectedVisaType]?.[input.field] ? 'ring-2 ring-red-400 border-red-400' : ''
                                                            }`}
                                                        disabled={savingVisa}
                                                    />
                                                )}
                                                {visaErrors[selectedVisaType]?.[input.field] && (
                                                    <p className="text-xs text-red-500">{visaErrors[selectedVisaType][input.field]}</p>
                                                )}
                                                {input.field === 'file' && (visaForms[selectedVisaType].file || visaForms[selectedVisaType].fileName) && (
                                                    <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                        <div className="flex items-center gap-2">
                                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M20 6L9 17l-5-5"></path>
                                                            </svg>
                                                            <span>{visaForms[selectedVisaType].file?.name || visaForms[selectedVisaType].fileName}</span>
                                                        </div>
                                                        {employee?.visaDetails?.[selectedVisaType]?.document?.data && (
                                                            <button
                                                                onClick={() => {
                                                                    setViewingDocument({
                                                                        data: employee.visaDetails[selectedVisaType].document.data,
                                                                        name: employee.visaDetails[selectedVisaType].document.name || `${selectedVisaType} Visa Document`,
                                                                        mimeType: employee.visaDetails[selectedVisaType].document.mimeType || 'application/pdf'
                                                                    });
                                                                    setShowDocumentViewer(true);
                                                                }}
                                                                className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                            >
                                                                View
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-700">
                                    <p className="font-semibold mb-1">Note:</p>
                                    <p>Visa requirements apply only if the employee&apos;s nationality is not UAE. Ensure the uploaded copy is clear and legible.</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                                <button
                                    onClick={handleCloseVisaModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleVisaSubmit}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                                >
                                    Save {visaTypes.find(type => type.key === selectedVisaType)?.label}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Emirates ID Modal */}
            {showEmiratesIdModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={handleCloseEmiratesIdModal}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">Emirates ID</h3>
                            <button
                                onClick={handleCloseEmiratesIdModal}
                                className="absolute right-0 text-gray-400 hover:text-gray-600"
                                disabled={savingEmiratesId}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Number <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={emiratesIdForm.number}
                                            onChange={(e) => {
                                                setEmiratesIdForm(prev => ({ ...prev, number: e.target.value }));
                                                if (emiratesIdErrors.number) {
                                                    setEmiratesIdErrors(prev => ({ ...prev, number: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${emiratesIdErrors.number ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingEmiratesId}
                                        />
                                        {emiratesIdErrors.number && (
                                            <p className="text-xs text-red-500">{emiratesIdErrors.number}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Issue Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={emiratesIdForm.issueDate}
                                            onChange={(e) => {
                                                setEmiratesIdForm(prev => ({ ...prev, issueDate: e.target.value }));
                                                if (emiratesIdErrors.issueDate) {
                                                    setEmiratesIdErrors(prev => ({ ...prev, issueDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${emiratesIdErrors.issueDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingEmiratesId}
                                        />
                                        {emiratesIdErrors.issueDate && (
                                            <p className="text-xs text-red-500">{emiratesIdErrors.issueDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Expiry Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={emiratesIdForm.expiryDate}
                                            onChange={(e) => {
                                                setEmiratesIdForm(prev => ({ ...prev, expiryDate: e.target.value }));
                                                if (emiratesIdErrors.expiryDate) {
                                                    setEmiratesIdErrors(prev => ({ ...prev, expiryDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${emiratesIdErrors.expiryDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingEmiratesId}
                                        />
                                        {emiratesIdErrors.expiryDate && (
                                            <p className="text-xs text-red-500">{emiratesIdErrors.expiryDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Document <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <input
                                            ref={emiratesIdFileRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleEmiratesFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${emiratesIdErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingEmiratesId}
                                        />
                                        {emiratesIdErrors.file && (
                                            <p className="text-xs text-red-500">{emiratesIdErrors.file}</p>
                                        )}
                                        {emiratesIdForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>{emiratesIdForm.file.name}</span>
                                            </div>
                                        )}
                                        {employee?.emiratesIdDetails?.document?.data && !emiratesIdForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>Current file: {employee.emiratesIdDetails.document.name || 'emirates-id.pdf'}</span>
                                                <button
                                                    onClick={() => {
                                                        setViewingDocument({
                                                            data: employee.emiratesIdDetails.document.data,
                                                            name: employee.emiratesIdDetails.document.name || 'Emirates ID.pdf',
                                                            mimeType: employee.emiratesIdDetails.document.mimeType || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={handleCloseEmiratesIdModal}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                disabled={savingEmiratesId}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEmiratesId}
                                className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                disabled={savingEmiratesId}
                            >
                                {savingEmiratesId ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Labour Card Modal */}
            {showLabourCardModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={handleCloseLabourCardModal}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">Labour Card</h3>
                            <button
                                onClick={handleCloseLabourCardModal}
                                className="absolute right-0 text-gray-400 hover:text-gray-600"
                                disabled={savingLabourCard}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Number <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={labourCardForm.number}
                                            onChange={(e) => {
                                                setLabourCardForm(prev => ({ ...prev, number: e.target.value }));
                                                if (labourCardErrors.number) {
                                                    setLabourCardErrors(prev => ({ ...prev, number: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${labourCardErrors.number ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingLabourCard}
                                        />
                                        {labourCardErrors.number && (
                                            <p className="text-xs text-red-500">{labourCardErrors.number}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Issue Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={labourCardForm.issueDate}
                                            onChange={(e) => {
                                                setLabourCardForm(prev => ({ ...prev, issueDate: e.target.value }));
                                                if (labourCardErrors.issueDate) {
                                                    setLabourCardErrors(prev => ({ ...prev, issueDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${labourCardErrors.issueDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingLabourCard}
                                        />
                                        {labourCardErrors.issueDate && (
                                            <p className="text-xs text-red-500">{labourCardErrors.issueDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Expiry Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={labourCardForm.expiryDate}
                                            onChange={(e) => {
                                                setLabourCardForm(prev => ({ ...prev, expiryDate: e.target.value }));
                                                if (labourCardErrors.expiryDate) {
                                                    setLabourCardErrors(prev => ({ ...prev, expiryDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${labourCardErrors.expiryDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingLabourCard}
                                        />
                                        {labourCardErrors.expiryDate && (
                                            <p className="text-xs text-red-500">{labourCardErrors.expiryDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Document <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <input
                                            ref={labourCardFileRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleLabourCardFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${labourCardErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingLabourCard}
                                        />
                                        {labourCardErrors.file && (
                                            <p className="text-xs text-red-500">{labourCardErrors.file}</p>
                                        )}
                                        {labourCardForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>{labourCardForm.file.name}</span>
                                            </div>
                                        )}
                                        {employee?.labourCardDetails?.document?.data && !labourCardForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>Current file: {employee.labourCardDetails.document.name || 'labour-card.pdf'}</span>
                                                <button
                                                    onClick={() => {
                                                        setViewingDocument({
                                                            data: employee.labourCardDetails.document.data,
                                                            name: employee.labourCardDetails.document.name || 'Labour Card.pdf',
                                                            mimeType: employee.labourCardDetails.document.mimeType || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={handleCloseLabourCardModal}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                disabled={savingLabourCard}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveLabourCard}
                                className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                disabled={savingLabourCard}
                            >
                                {savingLabourCard ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Medical Insurance Modal */}
            {showMedicalInsuranceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={handleCloseMedicalInsuranceModal}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">Medical Insurance</h3>
                            <button
                                onClick={handleCloseMedicalInsuranceModal}
                                className="absolute right-0 text-gray-400 hover:text-gray-600"
                                disabled={savingMedicalInsurance}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Provider <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={medicalInsuranceForm.provider}
                                            onChange={(e) => {
                                                setMedicalInsuranceForm(prev => ({ ...prev, provider: e.target.value }));
                                                if (medicalInsuranceErrors.provider) {
                                                    setMedicalInsuranceErrors(prev => ({ ...prev, provider: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${medicalInsuranceErrors.provider ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingMedicalInsurance}
                                        />
                                        {medicalInsuranceErrors.provider && (
                                            <p className="text-xs text-red-500">{medicalInsuranceErrors.provider}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Policy Number <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={medicalInsuranceForm.number}
                                            onChange={(e) => {
                                                setMedicalInsuranceForm(prev => ({ ...prev, number: e.target.value }));
                                                if (medicalInsuranceErrors.number) {
                                                    setMedicalInsuranceErrors(prev => ({ ...prev, number: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${medicalInsuranceErrors.number ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingMedicalInsurance}
                                        />
                                        {medicalInsuranceErrors.number && (
                                            <p className="text-xs text-red-500">{medicalInsuranceErrors.number}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Issue Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={medicalInsuranceForm.issueDate}
                                            onChange={(e) => {
                                                setMedicalInsuranceForm(prev => ({ ...prev, issueDate: e.target.value }));
                                                if (medicalInsuranceErrors.issueDate) {
                                                    setMedicalInsuranceErrors(prev => ({ ...prev, issueDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${medicalInsuranceErrors.issueDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingMedicalInsurance}
                                        />
                                        {medicalInsuranceErrors.issueDate && (
                                            <p className="text-xs text-red-500">{medicalInsuranceErrors.issueDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Expiry Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={medicalInsuranceForm.expiryDate}
                                            onChange={(e) => {
                                                setMedicalInsuranceForm(prev => ({ ...prev, expiryDate: e.target.value }));
                                                if (medicalInsuranceErrors.expiryDate) {
                                                    setMedicalInsuranceErrors(prev => ({ ...prev, expiryDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${medicalInsuranceErrors.expiryDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingMedicalInsurance}
                                        />
                                        {medicalInsuranceErrors.expiryDate && (
                                            <p className="text-xs text-red-500">{medicalInsuranceErrors.expiryDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Document <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <input
                                            ref={medicalInsuranceFileRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleMedicalInsuranceFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${medicalInsuranceErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingMedicalInsurance}
                                        />
                                        {medicalInsuranceErrors.file && (
                                            <p className="text-xs text-red-500">{medicalInsuranceErrors.file}</p>
                                        )}
                                        {medicalInsuranceForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>{medicalInsuranceForm.file.name}</span>
                                            </div>
                                        )}
                                        {employee?.medicalInsuranceDetails?.document?.data && !medicalInsuranceForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>Current file: {employee.medicalInsuranceDetails.document.name || 'medical-insurance.pdf'}</span>
                                                <button
                                                    onClick={() => {
                                                        setViewingDocument({
                                                            data: employee.medicalInsuranceDetails.document.data,
                                                            name: employee.medicalInsuranceDetails.document.name || 'Medical Insurance.pdf',
                                                            mimeType: employee.medicalInsuranceDetails.document.mimeType || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={handleCloseMedicalInsuranceModal}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                disabled={savingMedicalInsurance}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveMedicalInsurance}
                                className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                disabled={savingMedicalInsurance}
                            >
                                {savingMedicalInsurance ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Driving License Modal */}
            {showDrivingLicenseModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={handleCloseDrivingLicenseModal}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">Driving License</h3>
                            <button
                                onClick={handleCloseDrivingLicenseModal}
                                className="absolute right-0 text-gray-400 hover:text-gray-600"
                                disabled={savingDrivingLicense}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Number <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={drivingLicenseForm.number}
                                            onChange={(e) => {
                                                setDrivingLicenseForm(prev => ({ ...prev, number: e.target.value }));
                                                if (drivingLicenseErrors.number) {
                                                    setDrivingLicenseErrors(prev => ({ ...prev, number: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${drivingLicenseErrors.number ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingDrivingLicense}
                                        />
                                        {drivingLicenseErrors.number && (
                                            <p className="text-xs text-red-500">{drivingLicenseErrors.number}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Issue Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={drivingLicenseForm.issueDate}
                                            onChange={(e) => {
                                                setDrivingLicenseForm(prev => ({ ...prev, issueDate: e.target.value }));
                                                if (drivingLicenseErrors.issueDate) {
                                                    setDrivingLicenseErrors(prev => ({ ...prev, issueDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${drivingLicenseErrors.issueDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingDrivingLicense}
                                        />
                                        {drivingLicenseErrors.issueDate && (
                                            <p className="text-xs text-red-500">{drivingLicenseErrors.issueDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Expiry Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={drivingLicenseForm.expiryDate}
                                            onChange={(e) => {
                                                setDrivingLicenseForm(prev => ({ ...prev, expiryDate: e.target.value }));
                                                if (drivingLicenseErrors.expiryDate) {
                                                    setDrivingLicenseErrors(prev => ({ ...prev, expiryDate: '' }));
                                                }
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border ${drivingLicenseErrors.expiryDate ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                            disabled={savingDrivingLicense}
                                        />
                                        {drivingLicenseErrors.expiryDate && (
                                            <p className="text-xs text-red-500">{drivingLicenseErrors.expiryDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Document <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <input
                                            ref={drivingLicenseFileRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={handleDrivingLicenseFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${drivingLicenseErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingDrivingLicense}
                                        />
                                        {drivingLicenseErrors.file && (
                                            <p className="text-xs text-red-500">{drivingLicenseErrors.file}</p>
                                        )}
                                        {drivingLicenseForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>{drivingLicenseForm.file.name}</span>
                                            </div>
                                        )}
                                        {employee?.drivingLicenceDetails?.document?.data && !drivingLicenseForm.file && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <span>Current file: {employee.drivingLicenceDetails.document.name || 'driving-license.pdf'}</span>
                                                <button
                                                    onClick={() => {
                                                        setViewingDocument({
                                                            data: employee.drivingLicenceDetails.document.data,
                                                            name: employee.drivingLicenceDetails.document.name || 'Driving License.pdf',
                                                            mimeType: employee.drivingLicenceDetails.document.mimeType || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={handleCloseDrivingLicenseModal}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                disabled={savingDrivingLicense}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDrivingLicense}
                                className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                disabled={savingDrivingLicense}
                            >
                                {savingDrivingLicense ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bank Details Modal */}
            {
                showBankModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleCloseBankModal}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">Salary Bank Account</h3>
                                <button
                                    onClick={handleCloseBankModal}
                                    className="absolute right-0 text-gray-400 hover:text-gray-600"
                                    disabled={savingBank}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                                <div className="flex flex-col gap-3">
                                    {[
                                        { label: 'Bank Name', field: 'bankName', type: 'text', required: true, inputMode: 'text' },
                                        { label: 'Account Name', field: 'accountName', type: 'text', required: true, inputMode: 'text' },
                                        { label: 'Account Number', field: 'accountNumber', type: 'text', required: true, inputMode: 'numeric' },
                                        { label: 'IBAN Number', field: 'ibanNumber', type: 'text', required: true, inputMode: 'text' },
                                        { label: 'SWIFT Code', field: 'swiftCode', type: 'text', required: false, inputMode: 'text' },
                                        { label: 'Other Details (if any)', field: 'otherDetails', type: 'text', required: false, inputMode: 'text' }
                                    ].map((input) => (
                                        <div key={input.field} className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                                <input
                                                    type={input.type}
                                                    inputMode={input.inputMode}
                                                    value={bankForm[input.field]}
                                                    onChange={(e) => handleBankChange(input.field, e.target.value)}
                                                    onInput={(e) => {
                                                        // Additional real-time input restriction
                                                        if (input.field === 'bankName' || input.field === 'accountName') {
                                                            e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                                        } else if (input.field === 'accountNumber') {
                                                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                                                        } else if (input.field === 'ibanNumber') {
                                                            e.target.value = e.target.value.replace(/[^A-Za-z0-9\s]/g, '').toUpperCase();
                                                        } else if (input.field === 'swiftCode') {
                                                            e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                                        }
                                                    }}
                                                    className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${bankFormErrors[input.field]
                                                        ? 'border-red-500 focus:ring-red-500'
                                                        : 'border-[#E5E7EB]'
                                                        }`}
                                                    placeholder={`Enter ${input.label.toLowerCase()}`}
                                                    disabled={savingBank}
                                                />
                                                {bankFormErrors[input.field] && (
                                                    <span className="text-xs text-red-500 mt-1">
                                                        {bankFormErrors[input.field]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Bank Attachment */}
                                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            Attachment
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-2">
                                            <input
                                                ref={bankFileRef}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleBankFileChange}
                                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${bankFormErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                                disabled={savingBank}
                                            />
                                            {bankFormErrors.file && (
                                                <p className="text-xs text-red-500">{bankFormErrors.file}</p>
                                            )}
                                            {bankForm.file && (
                                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                    <span>{bankForm.file.name}</span>
                                                </div>
                                            )}
                                            {employee?.bankAttachment?.data && !bankForm.file && (
                                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                    <span>Current file: {employee.bankAttachment.name || 'bank-attachment.pdf'}</span>
                                                    <button
                                                        onClick={() => {
                                                            setViewingDocument({
                                                                data: employee.bankAttachment.data,
                                                                name: employee.bankAttachment.name || 'Bank Attachment.pdf',
                                                                mimeType: employee.bankAttachment.mimeType || 'application/pdf'
                                                            });
                                                            setShowDocumentViewer(true);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                    >
                                                        View
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                                <button
                                    onClick={handleCloseBankModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                    disabled={savingBank}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveBank}
                                    disabled={savingBank}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingBank ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Salary Details Modal */}
            {
                showSalaryModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleCloseSalaryModal}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">
                                    {editingSalaryIndex !== null ? 'Edit Salary Record' : hasSalaryDetails() ? 'Edit Salary Details' : 'Add Salary Record'}
                                </h3>
                                <button
                                    onClick={handleCloseSalaryModal}
                                    className="absolute right-0 text-gray-400 hover:text-gray-600"
                                    disabled={savingSalary}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                                <div className="flex flex-col gap-3">
                                    {/* Month */}
                                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            Month <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-1">
                                            <select
                                                value={salaryForm.month || ''}
                                                onChange={(e) => {
                                                    handleSalaryChange('month', e.target.value);
                                                    if (salaryFormErrors.month) {
                                                        setSalaryFormErrors(prev => ({ ...prev, month: '' }));
                                                    }
                                                }}
                                                className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.month ? 'border-red-500 focus:ring-red-500' : 'border-[#E5E7EB]'}`}
                                                disabled={savingSalary}
                                            >
                                                <option value="">Select Month</option>
                                                {monthOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {salaryFormErrors.month && (
                                                <span className="text-xs text-red-500 mt-1">{salaryFormErrors.month}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* From Date */}
                                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            From Date <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-1">
                                            <input
                                                type="date"
                                                value={salaryForm.fromDate || ''}
                                                onChange={(e) => {
                                                    handleSalaryChange('fromDate', e.target.value);
                                                    if (salaryFormErrors.fromDate) {
                                                        setSalaryFormErrors(prev => ({ ...prev, fromDate: '' }));
                                                    }
                                                }}
                                                className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors.fromDate ? 'border-red-500 focus:ring-red-500' : 'border-[#E5E7EB]'}`}
                                                disabled={savingSalary}
                                            />
                                            {salaryFormErrors.fromDate && (
                                                <span className="text-xs text-red-500 mt-1">{salaryFormErrors.fromDate}</span>
                                            )}
                                        </div>
                                    </div>

                                    {[
                                        { label: 'Basic Salary', field: 'basic', type: 'number', required: true, placeholder: 'Enter basic salary' },
                                        { label: 'Home Rent Allowance', field: 'houseRentAllowance', type: 'number', required: false, placeholder: 'Enter home rent allowance' },
                                        { label: 'Vehicle Allowance', field: 'vehicleAllowance', type: 'number', required: false, placeholder: 'Enter vehicle allowance' },
                                        { label: 'Fuel Allowance', field: 'fuelAllowance', type: 'number', required: false, placeholder: 'Enter fuel allowance' },
                                        { label: 'Other Allowance', field: 'otherAllowance', type: 'number', required: false, placeholder: 'Enter other allowance' },
                                        { label: 'Total Salary', field: 'totalSalary', type: 'readonly', required: false, placeholder: 'Auto-calculated' }
                                    ].map((input) => (
                                        <div key={input.field} className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                                {input.type === 'date' ? (
                                                    <input
                                                        type="date"
                                                        value={salaryForm[input.field]}
                                                        onChange={(e) => {
                                                            handleSalaryChange(input.field, e.target.value);
                                                            if (salaryFormErrors[input.field]) {
                                                                setSalaryFormErrors(prev => ({ ...prev, [input.field]: '' }));
                                                            }
                                                        }}
                                                        className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors[input.field]
                                                            ? 'border-red-500 focus:ring-red-500'
                                                            : 'border-[#E5E7EB]'
                                                            }`}
                                                        placeholder={input.placeholder}
                                                        disabled={savingSalary}
                                                    />
                                                ) : input.type === 'readonly' ? (
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">AED</span>
                                                        <input
                                                            type="text"
                                                            value={salaryForm[input.field] || '0.00'}
                                                            readOnly
                                                            className="w-full h-10 pl-12 pr-3 rounded-xl border bg-gray-100 text-gray-600 border-[#E5E7EB] cursor-not-allowed"
                                                            placeholder={input.placeholder}
                                                            disabled={true}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">AED</span>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={salaryForm[input.field]}
                                                            onChange={(e) => handleSalaryChange(input.field, e.target.value)}
                                                            onInput={(e) => {
                                                                // Restrict to numbers and decimal point only
                                                                e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                                                            }}
                                                            className={`w-full h-10 pl-12 pr-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${salaryFormErrors[input.field]
                                                                ? 'border-red-500 focus:ring-red-500'
                                                                : 'border-[#E5E7EB]'
                                                                }`}
                                                            placeholder={input.placeholder}
                                                            disabled={savingSalary}
                                                        />
                                                    </div>
                                                )}
                                                {salaryFormErrors[input.field] && (
                                                    <span className="text-xs text-red-500 mt-1">
                                                        {salaryFormErrors[input.field]}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Offer Letter Upload */}
                                    <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                            Offer Letter Upload <span className="text-red-500">*</span>
                                        </label>
                                        <div className="w-full md:flex-1 flex flex-col gap-1">
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleOfferLetterFileChange}
                                                className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${salaryFormErrors.offerLetter ? 'ring-2 ring-red-400 border-red-400' : ''
                                                    }`}
                                                disabled={savingSalary}
                                            />
                                            {salaryFormErrors.offerLetter && (
                                                <p className="text-xs text-red-500">{salaryFormErrors.offerLetter}</p>
                                            )}
                                            {(salaryForm.offerLetterFile || salaryForm.offerLetterFileName) && (
                                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                    <div className="flex items-center gap-2">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 6L9 17l-5-5"></path>
                                                        </svg>
                                                        <span>{salaryForm.offerLetterFile?.name || salaryForm.offerLetterFileName}</span>
                                                    </div>
                                                    {(salaryForm.offerLetterFileBase64 || (employee?.salaryHistory && employee.salaryHistory.some(entry => entry.offerLetter?.data)) || employee?.offerLetter?.data) && (
                                                        <button
                                                            onClick={() => {
                                                                // Get offer letter from current form or employee data
                                                                let offerLetterData = salaryForm.offerLetterFileBase64;
                                                                let offerLetterName = salaryForm.offerLetterFileName || salaryForm.offerLetterFile?.name || 'Offer Letter.pdf';
                                                                let offerLetterMime = salaryForm.offerLetterFileMime || salaryForm.offerLetterFile?.type || 'application/pdf';

                                                                // If no new file, try to get from employee data
                                                                if (!offerLetterData) {
                                                                    if (employee?.salaryHistory && employee.salaryHistory.length > 0) {
                                                                        const activeEntry = employee.salaryHistory.find(entry => !entry.toDate);
                                                                        if (activeEntry?.offerLetter?.data) {
                                                                            offerLetterData = activeEntry.offerLetter.data;
                                                                            offerLetterName = activeEntry.offerLetter.name || 'Offer Letter.pdf';
                                                                            offerLetterMime = activeEntry.offerLetter.mimeType || 'application/pdf';
                                                                        }
                                                                    }
                                                                    if (!offerLetterData && employee?.offerLetter?.data) {
                                                                        offerLetterData = employee.offerLetter.data;
                                                                        offerLetterName = employee.offerLetter.name || 'Offer Letter.pdf';
                                                                        offerLetterMime = employee.offerLetter.mimeType || 'application/pdf';
                                                                    }
                                                                }

                                                                if (offerLetterData) {
                                                                    setViewingDocument({
                                                                        data: offerLetterData,
                                                                        name: offerLetterName,
                                                                        mimeType: offerLetterMime
                                                                    });
                                                                    setShowDocumentViewer(true);
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                        >
                                                            View
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                                <button
                                    onClick={handleCloseSalaryModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                    disabled={savingSalary}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveSalary}
                                    disabled={savingSalary}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingSalary ? (hasSalaryDetails() && editingSalaryIndex === null ? 'Updating...' : 'Saving...') : (hasSalaryDetails() && editingSalaryIndex === null ? 'Update' : 'Save')}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Contact Details Modal */}
            {
                showContactModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleCloseContactModal}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[700px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">Emergency Contact Details</h3>
                                <button
                                    onClick={handleCloseContactModal}
                                    className="text-gray-400 hover:text-gray-600"
                                    disabled={savingContact}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                                <div className="border border-gray-100 rounded-2xl p-4 bg-white space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold text-gray-500">Name</span>
                                            <input
                                                type="text"
                                                value={activeContactForm.name}
                                                onChange={(e) => handleContactChange(0, 'name', e.target.value)}
                                                className={`w-full h-10 px-3 rounded-xl border ${contactFormErrors['0_name'] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                placeholder="Enter contact name"
                                                disabled={savingContact}
                                            />
                                            {contactFormErrors['0_name'] && (
                                                <p className="text-xs text-red-500 mt-1">{contactFormErrors['0_name']}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <span className="text-xs font-semibold text-gray-500">Relation</span>
                                            <select
                                                value={activeContactForm.relation}
                                                onChange={(e) => handleContactChange(0, 'relation', e.target.value)}
                                                className={`w-full h-10 px-3 rounded-xl border ${contactFormErrors['0_relation'] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                disabled={savingContact}
                                            >
                                                {['Self', 'Father', 'Mother', 'Friend', 'Spouse', 'Other'].map((option) => (
                                                    <option key={option} value={option}>
                                                        {option}
                                                    </option>
                                                ))}
                                            </select>
                                            {contactFormErrors['0_relation'] && (
                                                <p className="text-xs text-red-500 mt-1">{contactFormErrors['0_relation']}</p>
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-2 md:col-span-2">
                                            <span className="text-xs font-semibold text-gray-500">Phone Number</span>
                                            <PhoneInput
                                                country={DEFAULT_PHONE_COUNTRY}
                                                value={activeContactForm.number}
                                                onChange={(value, country) => handleContactChange(0, 'number', value, country)}
                                                enableSearch
                                                specialLabel=""
                                                inputStyle={{
                                                    width: '100%',
                                                    height: '42px',
                                                    borderRadius: '0.75rem',
                                                    borderColor: contactFormErrors['0_number'] ? '#ef4444' : '#E5E7EB'
                                                }}
                                                buttonStyle={{
                                                    borderTopLeftRadius: '0.75rem',
                                                    borderBottomLeftRadius: '0.75rem',
                                                    borderColor: contactFormErrors['0_number'] ? '#ef4444' : '#E5E7EB',
                                                    backgroundColor: '#fff'
                                                }}
                                                dropdownStyle={{ borderRadius: '0.75rem' }}
                                                placeholder="Enter contact number"
                                                disabled={savingContact}
                                            />
                                            {contactFormErrors['0_number'] && (
                                                <p className="text-xs text-red-500 mt-1">{contactFormErrors['0_number']}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                                <button
                                    onClick={handleCloseContactModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                    disabled={savingContact}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveContactDetails}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                    disabled={savingContact}
                                >
                                    {savingContact ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Personal Details Modal - Only show when on Personal Information tab */}
            {
                showPersonalModal && activeTab === 'personal' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleClosePersonalModal}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">Personal Details</h3>
                                <button
                                    onClick={handleClosePersonalModal}
                                    className="text-gray-400 hover:text-gray-600"
                                    disabled={savingPersonal}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                                {[
                                    { label: 'Email Address', field: 'email', type: 'email', required: true },
                                    { label: 'Contact Number', field: 'contactNumber', type: 'phone', required: true },
                                    { label: 'Date of Birth', field: 'dateOfBirth', type: 'date', required: true, placeholder: 'yyyy-mm-dd' },
                                    {
                                        label: 'Marital Status',
                                        field: 'maritalStatus',
                                        type: 'select',
                                        required: true,
                                        options: [
                                            { value: '', label: 'Select Marital Status' },
                                            { value: 'single', label: 'Single' },
                                            { value: 'married', label: 'Married' },
                                            { value: 'divorced', label: 'Divorced' },
                                            { value: 'widowed', label: 'Widowed' }
                                        ]
                                    },
                                    ...(personalForm.maritalStatus === 'married' ? [{ label: 'Number of Dependents', field: 'numberOfDependents', type: 'number', required: false, placeholder: 'Enter number of dependents' }] : []),
                                    { label: 'Father\'s Name', field: 'fathersName', type: 'text', required: true },
                                    {
                                        label: 'Gender',
                                        field: 'gender',
                                        type: 'select',
                                        required: true,
                                        options: [
                                            { value: '', label: 'Select Gender' },
                                            { value: 'male', label: 'Male' },
                                            { value: 'female', label: 'Female' },
                                            { value: 'other', label: 'Other' }
                                        ]
                                    },
                                    {
                                        label: 'Nationality',
                                        field: 'nationality',
                                        type: 'select',
                                        required: true,
                                        options: [
                                            { value: '', label: 'Select Nationality' },
                                            ...getAllCountriesOptions()
                                        ]
                                    }
                                ].map((input) => (
                                    <div key={input.field} className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555]">
                                            {input.label} {input.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {input.type === 'phone' ? (
                                            <div>
                                                <PhoneInput
                                                    country={DEFAULT_PHONE_COUNTRY}
                                                    value={personalForm.contactNumber}
                                                    onChange={(value, country) => handlePersonalChange('contactNumber', value, country)}
                                                    enableSearch
                                                    specialLabel=""
                                                    inputStyle={{
                                                        width: '100%',
                                                        height: '42px',
                                                        borderRadius: '0.75rem',
                                                        borderColor: personalFormErrors.contactNumber ? '#ef4444' : '#E5E7EB'
                                                    }}
                                                    buttonStyle={{
                                                        borderTopLeftRadius: '0.75rem',
                                                        borderBottomLeftRadius: '0.75rem',
                                                        borderColor: personalFormErrors.contactNumber ? '#ef4444' : '#E5E7EB',
                                                        backgroundColor: '#fff'
                                                    }}
                                                    dropdownStyle={{ borderRadius: '0.75rem' }}
                                                    placeholder="Enter contact number"
                                                    disabled={savingPersonal}
                                                />
                                                {personalFormErrors.contactNumber && (
                                                    <p className="text-xs text-red-500 mt-1">{personalFormErrors.contactNumber}</p>
                                                )}
                                            </div>
                                        ) : input.type === 'select' ? (
                                            <div className="w-full flex-1 flex flex-col gap-1">
                                                <select
                                                    value={personalForm[input.field]}
                                                    onChange={(e) => handlePersonalChange(input.field, e.target.value)}
                                                    className={`w-full h-10 px-3 rounded-xl border ${personalFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                    disabled={savingPersonal}
                                                >
                                                    {input.options.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {personalFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{personalFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full flex-1 flex flex-col gap-1">
                                                <input
                                                    type={input.type}
                                                    value={personalForm[input.field]}
                                                    onChange={(e) => handlePersonalChange(input.field, e.target.value)}
                                                    className={`w-full h-10 px-3 rounded-xl border ${personalFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                    placeholder={input.placeholder || `Enter ${input.label.toLowerCase()}`}
                                                    disabled={savingPersonal}
                                                />
                                                {personalFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{personalFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                                <button
                                    onClick={handleClosePersonalModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                    disabled={savingPersonal}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSavePersonalDetails}
                                    disabled={savingPersonal}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {savingPersonal ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }


            {/* Address Modal */}
            {
                showAddressModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={handleCloseAddressModal}></div>
                        <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                                <h3 className="text-[22px] font-semibold text-gray-800">
                                    {addressModalType === 'permanent' ? 'Permanent Address' : 'Current Address'}
                                </h3>
                                <button
                                    onClick={handleCloseAddressModal}
                                    className="text-gray-400 hover:text-gray-600"
                                    disabled={savingAddress}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                                {[
                                    { label: 'Address', field: 'line1', type: 'text', required: true },
                                    { label: 'Apartment/Flat', field: 'line2', type: 'text', required: false },
                                    { label: 'City', field: 'city', type: 'text', required: true },
                                    {
                                        label: 'Country',
                                        field: 'country',
                                        type: 'select',
                                        required: true,
                                        options: [
                                            { value: '', label: 'Select Country' },
                                            ...getAllCountriesOptions()
                                        ]
                                    },
                                    {
                                        label: 'Emirates/State',
                                        field: 'state',
                                        type: 'select',
                                        required: true,
                                        options: [
                                            { value: '', label: addressForm.country ? 'Select Emirates/State' : 'Select Country first' },
                                            ...addressStateOptions
                                        ],
                                        disabled: !addressForm.country || addressStateOptions.length === 0
                                    },
                                    { label: 'Postal Code', field: 'postalCode', type: 'text', required: false }
                                ].map((input) => (
                                    <div key={input.field} className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                        <label className="text-[14px] font-medium text-[#555555]">
                                            {input.label} {input.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {input.type === 'select' ? (
                                            <div className="w-full flex-1 flex flex-col gap-1">
                                                <select
                                                    value={addressForm[input.field]}
                                                    onChange={(e) => handleAddressChange(input.field, e.target.value)}
                                                    className={`w-full h-10 px-3 rounded-xl border ${addressFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${input.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    disabled={savingAddress || input.disabled}
                                                >
                                                    {input.options.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {addressFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{addressFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-full flex-1 flex flex-col gap-1">
                                                <input
                                                    type={input.type}
                                                    value={addressForm[input.field]}
                                                    onChange={(e) => handleAddressChange(input.field, e.target.value)}
                                                    className={`w-full h-10 px-3 rounded-xl border ${addressFormErrors[input.field] ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                                    placeholder={`Enter ${input.label.toLowerCase()}`}
                                                    disabled={savingAddress}
                                                />
                                                {addressFormErrors[input.field] && (
                                                    <p className="text-xs text-red-500 mt-1">{addressFormErrors[input.field]}</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                                <button
                                    onClick={handleCloseAddressModal}
                                    className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                    disabled={savingAddress}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveAddress}
                                    className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                    disabled={savingAddress}
                                >
                                    {savingAddress ? 'Saving...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add More Modal */}
            {
                showAddMoreModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40" onClick={() => {
                            setShowAddMoreModal(false);
                            setShowVisaTypeDropdownInModal(false);
                        }}></div>
                        <div className="relative bg-white/50 backdrop-blur-sm rounded-lg shadow-lg w-full max-w-[550px] p-4 flex flex-col">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                                <h3 className="text-lg font-semibold text-gray-800">Add More</h3>
                                <button
                                    onClick={() => {
                                        setShowAddMoreModal(false);
                                        setShowVisaTypeDropdownInModal(false);
                                    }}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-3 p-4">
                                {(() => {
                                    // Tab-based filter: 0 = basic details tab, 1 = personal information tab
                                    const tabFilter = activeTab === 'basic' ? 0 : activeTab === 'personal' ? 1 : 0;

                                    const hasVisitVisa = employee.visaDetails?.visit?.number;
                                    const hasEmploymentVisa = employee.visaDetails?.employment?.number;
                                    const hasSpouseVisa = employee.visaDetails?.spouse?.number;
                                    const hasAnyVisa = hasVisitVisa || hasEmploymentVisa || hasSpouseVisa;
                                    const hasEmploymentOrSpouseVisa = hasEmploymentVisa || hasSpouseVisa;

                                    return (
                                        <>
                                            {/* Passport button - only show if passport data doesn't exist AND tab is basic (0) */}
                                            {tabFilter === 0 && !employee.passportDetails?.number && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAddMoreModal(false);
                                                        setTimeout(() => {
                                                            handleOpenPassportModal();
                                                        }, 150);
                                                    }}
                                                    className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    Passport
                                                    <span className="text-sm leading-none">+</span>
                                                </button>
                                            )}

                                            {/* Visa button - only show if no visa exists and nationality is not UAE AND tab is basic (0) */}
                                            {tabFilter === 0 && isVisaRequirementApplicable && !hasAnyVisa && (
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setShowVisaTypeDropdownInModal(!showVisaTypeDropdownInModal);
                                                        }}
                                                        className="w-full px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                    >
                                                        Visa
                                                        <span className="text-sm leading-none">+</span>
                                                    </button>
                                                    {showVisaTypeDropdownInModal && (
                                                        <div className="absolute top-full left-0 mt-2 w-full z-[60] bg-white rounded-lg border border-gray-200 shadow-lg">
                                                            {visaTypes.map((type) => (
                                                                <button
                                                                    key={type.key}
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setShowAddMoreModal(false);
                                                                        setShowVisaTypeDropdownInModal(false);
                                                                        setTimeout(() => {
                                                                            handleOpenVisaModal(type.key);
                                                                        }, 150);
                                                                    }}
                                                                    className="w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                                                                >
                                                                    {type.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* If visit visa exists: Show only Medical Insurance AND tab is basic (0) - Hide if data exists */}
                                            {tabFilter === 0 && hasVisitVisa && !employee.medicalInsuranceDetails?.provider && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAddMoreModal(false);
                                                        setTimeout(() => {
                                                            handleOpenMedicalInsuranceModal();
                                                        }, 150);
                                                    }}
                                                    className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    Medical Insurance
                                                    <span className="text-sm leading-none">+</span>
                                                </button>
                                            )}

                                            {/* If employment or spouse visa exists: Show Emirates ID, Labour Card, Medical Insurance AND tab is basic (0) - Hide if data exists */}
                                            {tabFilter === 0 && hasEmploymentOrSpouseVisa && (
                                                <>
                                                    {!employee.emiratesIdDetails?.number && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowAddMoreModal(false);
                                                                setTimeout(() => {
                                                                    handleOpenEmiratesIdModal();
                                                                }, 150);
                                                            }}
                                                            className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                        >
                                                            Emirates ID
                                                            <span className="text-sm leading-none">+</span>
                                                        </button>
                                                    )}
                                                    {!employee.labourCardDetails?.number && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowAddMoreModal(false);
                                                                setTimeout(() => {
                                                                    handleOpenLabourCardModal();
                                                                }, 150);
                                                            }}
                                                            className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                        >
                                                            Labour Card
                                                            <span className="text-sm leading-none">+</span>
                                                        </button>
                                                    )}
                                                    {!employee.medicalInsuranceDetails?.provider && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setShowAddMoreModal(false);
                                                                setTimeout(() => {
                                                                    handleOpenMedicalInsuranceModal();
                                                                }, 150);
                                                            }}
                                                            className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                        >
                                                            Medical Insurance
                                                            <span className="text-sm leading-none">+</span>
                                                        </button>
                                                    )}
                                                </>
                                            )}

                                            {/* Driving License button - only show if data doesn't exist AND tab is basic (0) */}
                                            {tabFilter === 0 && !employee.drivingLicenceDetails?.number && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAddMoreModal(false);
                                                        setTimeout(() => {
                                                            handleOpenDrivingLicenseModal();
                                                        }, 150);
                                                    }}
                                                    className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    Driving License
                                                    <span className="text-sm leading-none">+</span>
                                                </button>
                                            )}

                                            {/* Current Address button - only show if current address doesn't exist AND tab is personal (1) */}
                                            {tabFilter === 1 && !hasCurrentAddress && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAddMoreModal(false);
                                                        setTimeout(() => {
                                                            handleOpenAddressModal('current');
                                                        }, 150);
                                                    }}
                                                    className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    Current Address
                                                    <span className="text-sm leading-none">+</span>
                                                </button>
                                            )}

                                            {/* Permanent Address button - only show if permanent address doesn't exist AND tab is personal (1) */}
                                            {tabFilter === 1 && !hasPermanentAddress && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAddMoreModal(false);
                                                        setTimeout(() => {
                                                            handleOpenAddressModal('permanent');
                                                        }, 150);
                                                    }}
                                                    className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    Permanent Address
                                                    <span className="text-sm leading-none">+</span>
                                                </button>
                                            )}

                                            {/* Emergency Contact button - only show if emergency contact doesn't exist AND tab is personal (1) */}
                                            {tabFilter === 1 && !hasContactDetails && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowAddMoreModal(false);
                                                        setTimeout(() => {
                                                            handleOpenContactModal();
                                                        }, 150);
                                                    }}
                                                    className="px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-sm cursor-pointer"
                                                >
                                                    Emergency Contact
                                                    <span className="text-sm leading-none">+</span>
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Education Modal */}
            {showEducationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => {
                        if (!savingEducation) {
                            setShowEducationModal(false);
                            setEditingEducationId(null);
                        }
                    }}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">{editingEducationId ? 'Edit Education' : 'Add Education'}</h3>
                            <button
                                onClick={() => {
                                    if (!savingEducation) {
                                        setShowEducationModal(false);
                                        setEditingEducationId(null);
                                    }
                                }}
                                className="absolute right-0 text-gray-400 hover:text-gray-600"
                                disabled={savingEducation}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        University / Board <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={educationForm.universityOrBoard}
                                            onChange={(e) => handleEducationChange('universityOrBoard', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to letters and spaces only
                                                e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${educationErrors.universityOrBoard ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingEducation}
                                        />
                                        {educationErrors.universityOrBoard && (
                                            <p className="text-xs text-red-500">{educationErrors.universityOrBoard}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        College / Institute <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={educationForm.collegeOrInstitute}
                                            onChange={(e) => handleEducationChange('collegeOrInstitute', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to letters and spaces only
                                                e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${educationErrors.collegeOrInstitute ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingEducation}
                                        />
                                        {educationErrors.collegeOrInstitute && (
                                            <p className="text-xs text-red-500">{educationErrors.collegeOrInstitute}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Course <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={educationForm.course}
                                            onChange={(e) => handleEducationChange('course', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to letters and spaces only
                                                e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${educationErrors.course ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingEducation}
                                        />
                                        {educationErrors.course && (
                                            <p className="text-xs text-red-500">{educationErrors.course}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Field of Study <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={educationForm.fieldOfStudy}
                                            onChange={(e) => handleEducationChange('fieldOfStudy', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to letters and spaces only
                                                e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${educationErrors.fieldOfStudy ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingEducation}
                                        />
                                        {educationErrors.fieldOfStudy && (
                                            <p className="text-xs text-red-500">{educationErrors.fieldOfStudy}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Completed Year <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={educationForm.completedYear}
                                            onChange={(e) => handleEducationChange('completedYear', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to digits only, max 4 digits
                                                e.target.value = e.target.value.replace(/[^\d]/g, '').slice(0, 4);
                                            }}
                                            maxLength={4}
                                            placeholder="YYYY"
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${educationErrors.completedYear ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingEducation}
                                        />
                                        {educationErrors.completedYear && (
                                            <p className="text-xs text-red-500">{educationErrors.completedYear}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Certificate <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={educationCertificateFileRef}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleEducationFileChange}
                                                className="hidden"
                                                disabled={savingEducation}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => educationCertificateFileRef.current?.click()}
                                                disabled={savingEducation}
                                                className={`px-4 py-2 bg-white border rounded-lg text-blue-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${educationErrors.certificate ? 'border-red-400' : 'border-gray-300'}`}
                                            >
                                                Choose File
                                            </button>
                                            <input
                                                type="text"
                                                readOnly
                                                value={educationForm.certificateName || 'No file chosen'}
                                                className={`flex-1 h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-600 text-sm ${educationErrors.certificate ? 'ring-2 ring-red-400 border-red-400' : 'border-[#E5E7EB]'}`}
                                                placeholder="No file chosen"
                                            />
                                        </div>
                                        {educationErrors.certificate && (
                                            <p className="text-xs text-red-500">{educationErrors.certificate}</p>
                                        )}
                                        {educationForm.certificateName && educationForm.certificateData && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <div className="flex items-center gap-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 6L9 17l-5-5"></path>
                                                    </svg>
                                                    <span>{educationForm.certificateName}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewingDocument({
                                                            data: educationForm.certificateData,
                                                            name: educationForm.certificateName,
                                                            mimeType: educationForm.certificateMime || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500">Upload file in PDF, JPEG, or PNG format only</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    if (!savingEducation) {
                                        setShowEducationModal(false);
                                        setEditingEducationId(null);
                                    }
                                }}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                disabled={savingEducation}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEducation}
                                className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                disabled={savingEducation}
                            >
                                {savingEducation ? 'Saving...' : editingEducationId ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Experience Modal */}
            {showExperienceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => {
                        if (!savingExperience) {
                            setShowExperienceModal(false);
                            setEditingExperienceId(null);
                        }
                    }}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">{editingExperienceId ? 'Edit Experience' : 'Add Experience'}</h3>
                            <button
                                onClick={() => {
                                    if (!savingExperience) {
                                        setShowExperienceModal(false);
                                        setEditingExperienceId(null);
                                    }
                                }}
                                className="absolute right-0 text-gray-400 hover:text-gray-600"
                                disabled={savingExperience}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Company <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={experienceForm.company}
                                            onChange={(e) => handleExperienceChange('company', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to letters, numbers, and spaces only
                                                e.target.value = e.target.value.replace(/[^A-Za-z0-9\s]/g, '');
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${experienceErrors.company ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingExperience}
                                        />
                                        {experienceErrors.company && (
                                            <p className="text-xs text-red-500">{experienceErrors.company}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Designation <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="text"
                                            value={experienceForm.designation}
                                            onChange={(e) => handleExperienceChange('designation', e.target.value)}
                                            onInput={(e) => {
                                                // Restrict to letters, numbers, and spaces only
                                                e.target.value = e.target.value.replace(/[^A-Za-z0-9\s]/g, '');
                                            }}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${experienceErrors.designation ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingExperience}
                                        />
                                        {experienceErrors.designation && (
                                            <p className="text-xs text-red-500">{experienceErrors.designation}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Start Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={experienceForm.startDate}
                                            onChange={(e) => handleExperienceChange('startDate', e.target.value)}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${experienceErrors.startDate ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingExperience}
                                        />
                                        {experienceErrors.startDate && (
                                            <p className="text-xs text-red-500">{experienceErrors.startDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        End Date <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-1">
                                        <input
                                            type="date"
                                            value={experienceForm.endDate}
                                            onChange={(e) => handleExperienceChange('endDate', e.target.value)}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${experienceErrors.endDate ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingExperience}
                                        />
                                        {experienceErrors.endDate && (
                                            <p className="text-xs text-red-500">{experienceErrors.endDate}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Certificate <span className="text-red-500">*</span>
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                ref={experienceCertificateFileRef}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                onChange={handleExperienceFileChange}
                                                className="hidden"
                                                disabled={savingExperience}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => experienceCertificateFileRef.current?.click()}
                                                disabled={savingExperience}
                                                className={`px-4 py-2 bg-white border rounded-lg text-blue-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${experienceErrors.certificate ? 'border-red-400' : 'border-gray-300'}`}
                                            >
                                                Choose File
                                            </button>
                                            <input
                                                type="text"
                                                readOnly
                                                value={experienceForm.certificateName || 'No file chosen'}
                                                className={`flex-1 h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-600 text-sm ${experienceErrors.certificate ? 'ring-2 ring-red-400 border-red-400' : 'border-[#E5E7EB]'}`}
                                                placeholder="No file chosen"
                                            />
                                        </div>
                                        {experienceErrors.certificate && (
                                            <p className="text-xs text-red-500">{experienceErrors.certificate}</p>
                                        )}
                                        {experienceForm.certificateName && experienceForm.certificateData && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <div className="flex items-center gap-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 6L9 17l-5-5"></path>
                                                    </svg>
                                                    <span>{experienceForm.certificateName}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setViewingDocument({
                                                            data: experienceForm.certificateData,
                                                            name: experienceForm.certificateName,
                                                            mimeType: experienceForm.certificateMime || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                                                >
                                                    View
                                                </button>
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500">Upload file in PDF, JPEG, or PNG format only</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    if (!savingExperience) {
                                        setShowExperienceModal(false);
                                        setEditingExperienceId(null);
                                    }
                                }}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                disabled={savingExperience}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveExperience}
                                className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                disabled={savingExperience}
                            >
                                {savingExperience ? 'Saving...' : editingExperienceId ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Modal */}
            {showDocumentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => {
                        if (!savingDocument) {
                            setShowDocumentModal(false);
                            setDocumentErrors({});
                        }
                    }}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">{editingDocumentIndex !== null ? 'Edit Document' : 'Add Document'}</h3>
                            <button
                                onClick={() => {
                                    if (!savingDocument) {
                                        setShowDocumentModal(false);
                                        setDocumentErrors({});
                                    }
                                }}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={savingDocument}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Document Type <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={documentForm.type}
                                    onChange={(e) => setDocumentForm(prev => ({ ...prev, type: e.target.value }))}
                                    className={`w-full h-10 px-3 rounded-xl border ${documentErrors.type ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    placeholder="e.g., Passport, Visa, Emirates ID"
                                    disabled={savingDocument}
                                />
                                {documentErrors.type && (
                                    <p className="text-xs text-red-500">{documentErrors.type}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Document File {editingDocumentIndex === null && <span className="text-red-500">*</span>}
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={documentFileRef}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleDocumentFileChange}
                                        className="hidden"
                                        disabled={savingDocument}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => documentFileRef.current?.click()}
                                        disabled={savingDocument}
                                        className={`px-4 py-2 bg-white border rounded-lg text-blue-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50 ${documentErrors.file ? 'border-red-400' : 'border-gray-300'}`}
                                    >
                                        Choose File
                                    </button>
                                    <input
                                        type="text"
                                        readOnly
                                        value={documentForm.fileName || (editingDocumentIndex !== null && documentForm.fileBase64 ? 'Current file attached' : 'No file chosen')}
                                        className="flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-600 text-sm"
                                        placeholder="No file chosen"
                                    />
                                </div>
                                {documentErrors.file && (
                                    <p className="text-xs text-red-500">{documentErrors.file}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                            <button
                                onClick={() => {
                                    if (!savingDocument) {
                                        setShowDocumentModal(false);
                                        setDocumentErrors({});
                                    }
                                }}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                disabled={savingDocument}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveDocument}
                                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                disabled={savingDocument}
                            >
                                {savingDocument ? 'Saving...' : editingDocumentIndex !== null ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Training Modal */}
            {showTrainingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40" onClick={() => {
                        if (!savingTraining) {
                            setShowTrainingModal(false);
                            setTrainingErrors({});
                        }
                    }}></div>
                    <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                            <h3 className="text-[22px] font-semibold text-gray-800">{editingTrainingIndex !== null ? 'Edit Training' : 'Add Training'}</h3>
                            <button
                                onClick={() => {
                                    if (!savingTraining) {
                                        setShowTrainingModal(false);
                                        setTrainingErrors({});
                                    }
                                }}
                                className="text-gray-400 hover:text-gray-600"
                                disabled={savingTraining}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                        <div className="space-y-3 px-1 md:px-2 pt-4 pb-2 flex-1 overflow-y-auto modal-scroll">
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Training Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={trainingForm.trainingName}
                                    onChange={(e) => setTrainingForm(prev => ({ ...prev, trainingName: e.target.value }))}
                                    className={`w-full h-10 px-3 rounded-xl border ${trainingErrors.trainingName ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    placeholder="Enter training name"
                                    disabled={savingTraining}
                                />
                                {trainingErrors.trainingName && (
                                    <p className="text-xs text-red-500">{trainingErrors.trainingName}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Training Details
                                </label>
                                <textarea
                                    value={trainingForm.trainingDetails}
                                    onChange={(e) => setTrainingForm(prev => ({ ...prev, trainingDetails: e.target.value }))}
                                    className="w-full h-24 px-3 py-2 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                    placeholder="Enter training details"
                                    disabled={savingTraining}
                                />
                            </div>
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Training Provider <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={trainingForm.trainingFrom}
                                    onChange={(e) => setTrainingForm(prev => ({ ...prev, trainingFrom: e.target.value }))}
                                    className={`w-full h-10 px-3 rounded-xl border ${trainingErrors.trainingFrom ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    placeholder="Enter training provider"
                                    disabled={savingTraining}
                                />
                                {trainingErrors.trainingFrom && (
                                    <p className="text-xs text-red-500">{trainingErrors.trainingFrom}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Training Date <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={trainingForm.trainingDate}
                                    onChange={(e) => setTrainingForm(prev => ({ ...prev, trainingDate: e.target.value }))}
                                    className={`w-full h-10 px-3 rounded-xl border ${trainingErrors.trainingDate ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                    disabled={savingTraining}
                                />
                                {trainingErrors.trainingDate && (
                                    <p className="text-xs text-red-500">{trainingErrors.trainingDate}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Training Cost (AED)
                                </label>
                                <input
                                    type="number"
                                    value={trainingForm.trainingCost}
                                    onChange={(e) => setTrainingForm(prev => ({ ...prev, trainingCost: e.target.value }))}
                                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                    placeholder="Enter training cost"
                                    disabled={savingTraining}
                                />
                            </div>
                            <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                <label className="text-[14px] font-medium text-[#555555]">
                                    Certificate
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={trainingCertificateFileRef}
                                        type="file"
                                        accept=".pdf,.jpg,.jpeg,.png"
                                        onChange={handleTrainingFileChange}
                                        className="hidden"
                                        disabled={savingTraining}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => trainingCertificateFileRef.current?.click()}
                                        disabled={savingTraining}
                                        className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-blue-600 font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Choose File
                                    </button>
                                    <input
                                        type="text"
                                        readOnly
                                        value={trainingForm.certificateName || (editingTrainingIndex !== null && trainingForm.certificateBase64 ? 'Current certificate attached' : 'No file chosen')}
                                        className="flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-600 text-sm"
                                        placeholder="No file chosen"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                            <button
                                onClick={() => {
                                    if (!savingTraining) {
                                        setShowTrainingModal(false);
                                        setTrainingErrors({});
                                    }
                                }}
                                className="text-red-500 hover:text-red-600 font-semibold text-sm"
                                disabled={savingTraining}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTraining}
                                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                                disabled={savingTraining}
                            >
                                {savingTraining ? 'Saving...' : editingTrainingIndex !== null ? 'Update' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Viewer Modal */}
            {showDocumentViewer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowDocumentViewer(false)}></div>
                    <div className="relative bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800">{viewingDocument.name}</h3>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = `data:${viewingDocument.mimeType};base64,${viewingDocument.data}`;
                                        link.download = viewingDocument.name;
                                        link.click();
                                    }}
                                    className="text-blue-600 hover:text-blue-700"
                                    title="Download"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                        <polyline points="7 10 12 15 17 10"></polyline>
                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setShowDocumentViewer(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-gray-100">
                            {viewingDocument.mimeType?.includes('pdf') ? (
                                <iframe
                                    src={`data:${viewingDocument.mimeType};base64,${viewingDocument.data}`}
                                    className="w-full h-full min-h-[600px] border-0"
                                    title={viewingDocument.name}
                                />
                            ) : (
                                <img
                                    src={`data:${viewingDocument.mimeType};base64,${viewingDocument.data}`}
                                    alt={viewingDocument.name}
                                    className="max-w-full h-auto mx-auto"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

