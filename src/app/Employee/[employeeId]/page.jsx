'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
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


export default function EmployeeProfilePage() {
    const params = useParams();
    const router = useRouter();
    const employeeId = params?.employeeId;
    const DEFAULT_PHONE_COUNTRY = 'ae';
    const formatPhoneForInput = (value) => value ? value.replace(/^\+/, '') : '';
    const formatPhoneForSave = (value) => {
        if (!value) return '';
        return value.startsWith('+') ? value : `+${value}`;
    };
    const normalizeText = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '');

    const normalizeContactNumber = (value) => {
        const trimmed = value?.toString().trim() || '';
        if (!trimmed) return '';
        const cleaned = trimmed.replace(/\s+/g, '');
        if (!cleaned) return '';
        return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    };

    const sanitizeContact = (contact) => ({
        name: contact?.name?.trim() || '',
        relation: contact?.relation || 'Self',
        number: normalizeContactNumber(contact?.number || '')
    });

    const contactsAreSame = (a, b) => {
        if (!a || !b) return false;
        const nameA = (a.name || '').trim().toLowerCase();
        const nameB = (b.name || '').trim().toLowerCase();
        return (a.number || '').trim() === (b.number || '').trim() && nameA === nameB;
    };

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [activeSubTab, setActiveSubTab] = useState('basic-details');
    const [selectedSalaryAction, setSelectedSalaryAction] = useState('Salary History');
    const [imageError, setImageError] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        employeeId: '',
        contactNumber: '',
        personalEmail: '',
        email: '',
        nationality: '',
        status: '',
        probationPeriod: null,
        reportingAuthority: ''
    });
    const [showPersonalModal, setShowPersonalModal] = useState(false);
    const [personalForm, setPersonalForm] = useState({
        email: '',
        contactNumber: '',
        dateOfBirth: '',
        maritalStatus: '',
        fathersName: '',
        gender: '',
        nationality: ''
    });
    const [savingPersonal, setSavingPersonal] = useState(false);
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
        ifscCode: '',
        otherDetails: ''
    });
    const [savingBank, setSavingBank] = useState(false);
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
    const [savingAddress, setSavingAddress] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
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
    const [extractingPassport, setExtractingPassport] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const fileInputRef = useRef(null);
    const [showDocumentViewer, setShowDocumentViewer] = useState(false);
    const [viewingDocument, setViewingDocument] = useState({
        data: '',
        name: '',
        mimeType: ''
    });
    const reportingAuthorityDisplayName = useMemo(() => {
        if (!employee?.reportingAuthority) return null;
        const match = reportingAuthorityOptions.find(option => option.value === employee.reportingAuthority);
        return match?.label || null;
    }, [employee?.reportingAuthority, reportingAuthorityOptions]);

    const reportingAuthorityEmail = useMemo(() => {
        if (!employee?.reportingAuthority) return null;
        const match = reportingAuthorityOptions.find(option => option.value === employee.reportingAuthority);
        return match?.email || null;
    }, [employee?.reportingAuthority, reportingAuthorityOptions]);
    const [sendingApproval, setSendingApproval] = useState(false);
    const [activatingProfile, setActivatingProfile] = useState(false);

    const passportFieldConfig = [
        { label: 'Passport Number', field: 'number', type: 'text', required: true },
        { label: 'Nationality', field: 'nationality', type: 'text', required: true },
        { label: 'Issue Date', field: 'issueDate', type: 'date', required: true },
        { label: 'Expiry Date', field: 'expiryDate', type: 'date', required: true },
        { label: 'Country of Issue', field: 'countryOfIssue', type: 'text', required: true }
    ];
    const openEditModal = () => {
        if (!employee) return;
        setEditForm({
            employeeId: employee.employeeId || '',
            contactNumber: employee.contactNumber || '',
            email: employee.email || employee.workEmail || '',
            nationality: employee.nationality || employee.country || '',
            status: employee.status || 'Probation',
            probationPeriod: employee.probationPeriod || null,
            reportingAuthority: employee.reportingAuthority || ''
        });
        setShowEditModal(true);
    };

    const handleOpenPersonalModal = () => {
        if (!employee) return;
        setPersonalForm({
            email: employee.email || employee.workEmail || '',
            contactNumber: formatPhoneForInput(employee.contactNumber || ''),
            dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.substring(0, 10) : '',
            maritalStatus: employee.maritalStatus || '',
            fathersName: employee.fathersName || '',
            gender: employee.gender || '',
            nationality: employee.nationality || employee.country || ''
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
            nationality: ''
        });
    };

    const handlePersonalChange = (field, value) => {
        setPersonalForm(prev => ({ ...prev, [field]: value }));
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
    };

    const handleContactChange = (index, field, value) => {
        setContactForms(prev => prev.map((contact, i) => (i === index ? { ...contact, [field]: value } : contact)));
    };

    const handleAddContactRow = () => {
        setContactForms(prev => [...prev, { name: '', relation: 'Self', number: '' }]);
    };

    const handleRemoveContactRow = (index) => {
        setContactForms(prev => prev.filter((_, i) => i !== index));
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => {
            const updated = { ...prev, [field]: value };
            // Clear probationPeriod if status changes from Probation to something else
            if (field === 'status' && value !== 'Probation') {
                updated.probationPeriod = null;
            }
            return updated;
        });
    };

    const handlePassportChange = (field, value) => {
        setPassportForm(prev => ({ ...prev, [field]: value }));
    };

    // Extract text from PDF - COMMENTED OUT
    /* const extractTextFromPDF = async (file) => {
        try {
            // Dynamic import of pdfjs-dist
            const pdfjsLib = await import('pdfjs-dist');

            // Set worker source - try local first, then CDN
            if (typeof window !== 'undefined') {
                // Try local worker file first
                pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
            } else {
                // Fallback to CDN for SSR
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
                useWorkerFetch: false,
                isEvalSupported: false,
                useSystemFonts: true
            }).promise;

            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + ' ';
                console.log(`📄 Page ${i} text length:`, pageText.length);
            }

            console.log('========================================');
            console.log('📄 EXTRACTED TEXT FROM PDF:');
            console.log('========================================');
            console.log('Total Pages:', pdf.numPages);
            console.log('Total Text Length:', fullText.length);
            console.log('----------------------------------------');
            console.log('FULL EXTRACTED TEXT:');
            console.log(fullText);
            console.log('----------------------------------------');
            console.log('First 2000 characters:');
            console.log(fullText.substring(0, 2000));
            console.log('========================================');

            return fullText;
        } catch (error) {
            console.error('Error extracting PDF text:', error);
            // Try alternative worker configuration with jsdelivr CDN
            try {
                const pdfjsLib = await import('pdfjs-dist');
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs`;

                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({
                    data: arrayBuffer,
                    useWorkerFetch: false,
                    isEvalSupported: false
                }).promise;

                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + ' ';
                    console.log(`📄 Page ${i} text length:`, pageText.length);
                }

                console.log('========================================');
                console.log('📄 EXTRACTED TEXT FROM PDF (Retry):');
                console.log('========================================');
                console.log('Total Pages:', pdf.numPages);
                console.log('Total Text Length:', fullText.length);
                console.log('----------------------------------------');
                console.log('FULL EXTRACTED TEXT:');
                console.log(fullText);
                console.log('----------------------------------------');
                console.log('First 2000 characters:');
                console.log(fullText.substring(0, 2000));
                console.log('========================================');

                return fullText;
            } catch (retryError) {
                console.error('Retry failed:', retryError);
                throw new Error('Failed to extract text from PDF. Please enter details manually.');
            }
        }
    }; */

    // Parse passport details from extracted text - COMMENTED OUT
    /* const parsePassportDetails = (text) => {
        console.log('🔍 Parsing passport details from text...');
        console.log('📄 Full extracted text:', text);
        console.log('📄 Text length:', text.length);
        console.log('📄 First 1000 chars:', text.substring(0, 1000));

        const details = {
            number: '',
            issueDate: '',
            countryOfIssue: '',
            expiryDate: ''
        };

        // Try multiple patterns for passport number
        const passportPatterns = [
            /(?:पासपोर्ट\s*न\.|Passport\s*No\.?)[\s:]*([A-Z]{1,2}\d{6,9})/i,
            /(?:passport\s*number|passport\s*no|pass\s*no)[\s:]*([A-Z0-9]{6,12})/i,
            /Passport\s*No[.:]\s*([A-Z]{1,2}\d{6,9})/i,
            /\b([A-Z]{2}\d{6})\b/, // AF637144 pattern
            /\b([A-Z]{1,2}\d{6,9})\b/ // Generic pattern
        ];

        for (let i = 0; i < passportPatterns.length; i++) {
            const match = text.match(passportPatterns[i]);
            if (match && match[1] && match[1].length >= 7) {
                details.number = match[1].trim();
                console.log(`✅ Found passport number (pattern ${i + 1}):`, details.number);
                break;
            }
        }

        if (!details.number) {
            console.log('❌ Could not find passport number');
            // Try to find any alphanumeric code that looks like a passport number
            const allMatches = text.match(/\b([A-Z]{1,2}\d{6,9})\b/g);
            if (allMatches) {
                console.log('🔍 Found potential passport numbers:', allMatches);
                details.number = allMatches[0];
                console.log('✅ Using first match:', details.number);
            }
        }

        // Try multiple patterns for issue date
        const issueDatePatterns = [
            /(?:जारी\s*करने\s*की\s*तिथि|Date\s*of\s*Issue)[\s:]*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/i,
            /(?:date\s*of\s*issue|issued|issue\s*date)[\s:]*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/i,
            /Date\s*of\s*Issue[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
            /(\d{1,2}\/\d{1,2}\/\d{4})/g // Find all dates and use the first one
        ];

        for (let i = 0; i < issueDatePatterns.length; i++) {
            const match = text.match(issueDatePatterns[i]);
            if (match) {
                const dateStr = match[1];
                const formatted = formatDateFromText(dateStr);
                if (formatted) {
                    details.issueDate = formatted;
                    console.log(`✅ Found issue date (pattern ${i + 1}):`, dateStr, '→', formatted);
                    break;
                }
            }
        }

        if (!details.issueDate) {
            console.log('❌ Could not find issue date');
            // Try to find any date pattern
            const dateMatches = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
            if (dateMatches && dateMatches.length > 0) {
                console.log('🔍 Found dates in text:', dateMatches);
                details.issueDate = formatDateFromText(dateMatches[0]);
                console.log('✅ Using first date as issue date:', details.issueDate);
            }
        }

        // Try multiple patterns for place of issue
        const placePatterns = [
            /(?:जारी\s*करने\s*का\s*स्थान|Place\s*of\s*Issue)[\s:]*([A-Z][a-zA-Z\s]{2,30})/i,
            /(?:place\s*of\s*issue|issued\s*at|issued\s*in)[\s:]*([A-Z][a-zA-Z\s]{2,30})/i,
            /Place\s*of\s*Issue[:\s]*([A-Z][A-Z\s]{2,20})/i,
            /COCHIN|MUMBAI|DELHI|KOLKATA|CHENNAI|BANGALORE|HYDERABAD/i // Common Indian passport issue places
        ];

        for (let i = 0; i < placePatterns.length; i++) {
            const match = text.match(placePatterns[i]);
            if (match) {
                details.countryOfIssue = match[1] ? match[1].trim() : match[0].trim();
                console.log(`✅ Found place of issue (pattern ${i + 1}):`, details.countryOfIssue);
                break;
            }
        }

        if (!details.countryOfIssue) {
            console.log('❌ Could not find place of issue');
        }

        // Try multiple patterns for expiry date
        const expiryDatePatterns = [
            /(?:समाप्ति\s*की\s*तिथि|Date\s*of\s*Expiry)[\s:]*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/i,
            /(?:date\s*of\s*expiry|expires|expiry\s*date|valid\s*until)[\s:]*(\d{1,2}[.\-\/]\d{1,2}[.\-\/]\d{2,4})/i,
            /Date\s*of\s*Expiry[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i
        ];

        for (let i = 0; i < expiryDatePatterns.length; i++) {
            const match = text.match(expiryDatePatterns[i]);
            if (match) {
                const dateStr = match[1];
                const formatted = formatDateFromText(dateStr);
                if (formatted) {
                    details.expiryDate = formatted;
                    console.log(`✅ Found expiry date (pattern ${i + 1}):`, dateStr, '→', formatted);
                    break;
                }
            }
        }

        if (!details.expiryDate) {
            console.log('❌ Could not find expiry date');
            // Try to find the second date (usually expiry comes after issue)
            const dateMatches = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/g);
            if (dateMatches && dateMatches.length > 1) {
                console.log('🔍 Found multiple dates:', dateMatches);
                details.expiryDate = formatDateFromText(dateMatches[1]);
                console.log('✅ Using second date as expiry date:', details.expiryDate);
            }
        }

        console.log('📋 Final extracted details:', details);
        return details;
    }; */

    // Format date from text to YYYY-MM-DD format - COMMENTED OUT
    /* const formatDateFromText = (dateStr) => {
        // Handle different date formats
        const formats = [
            /(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{2,4})/, // DD.MM.YYYY or DD/MM/YYYY
        ];

        for (const format of formats) {
            const match = dateStr.match(format);
            if (match) {
                let day = match[1].padStart(2, '0');
                let month = match[2].padStart(2, '0');
                let year = match[3];

                // Handle 2-digit years
                if (year.length === 2) {
                    year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
                }

                return `${year}-${month}-${day}`;
            }
        }
        return '';
    }; */

    // Document AI API call - COMMENTED OUT
    /* const callDocumentAIApi = async (file) => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axiosInstance.post('/document-ai/parse-passport', formData);

        return response.data;
    }; */

    // Simplified file upload - no extraction, just set the file
    const handlePassportFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setPassportForm(prev => ({ ...prev, file }));
            // File is set, user can fill other fields and submit
        }
    };

    /* EXTRACTION CODE COMMENTED OUT - File upload works without extraction
            // If PDF, extract details automatically
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                try {
                    setExtractingPassport(true);
                    setStatusMessage('Uploading document for AI extraction...');

                    const response = await callDocumentAIApi(file);
                    const extractedDetails = response.data || response;

                    setPassportForm(prev => ({
                        ...prev,
                        number: extractedDetails.number || prev.number || '',
                        nationality: extractedDetails.nationality || prev.nationality || '',
                        issueDate: extractedDetails.issueDate || prev.issueDate || '',
                        expiryDate: extractedDetails.expiryDate || prev.expiryDate || '',
                        countryOfIssue: extractedDetails.placeOfIssue || extractedDetails.countryOfIssue || prev.countryOfIssue || ''
                    }));

                    setAlertDialog({
                        open: true,
                        title: "Details Extracted by AI",
                        description: "Passport details have been automatically extracted. Please verify before saving."
                    });
                    return;
                } catch (error) {
                    console.error('Error extracting passport details:', error);
                    setAlertDialog({
                        open: true,
                        title: "Extraction Failed",
                        description: error.response?.data?.message || error.message || "AI Extraction failed. Trying fallback method."
                    });

                    // Attempt local text extraction as fallback
                    try {
                        setStatusMessage('Falling back to local text extraction...');
                        console.log('📄 Using text extraction fallback...');
                        const pdfText = await extractTextFromPDF(file);

                        console.log('========================================');
                        console.log('📄 RAW TEXT EXTRACTED FROM PDF:');
                        console.log('========================================');
                        console.log(pdfText);
                        console.log('========================================');
                        console.log('📊 PDF TEXT STATS:');
                        console.log('Total length:', pdfText.length);
                        console.log('First 2000 characters:');
                        console.log(pdfText.substring(0, 2000));
                        console.log('========================================');

                        const extractedDetails = parsePassportDetails(pdfText);

                        setPassportForm(prev => ({
                            ...prev,
                            number: extractedDetails.number || prev.number || '',
                            nationality: extractedDetails.nationality || prev.nationality || '',
                            issueDate: extractedDetails.issueDate || prev.issueDate || '',
                            expiryDate: extractedDetails.expiryDate || prev.expiryDate || '',
                            countryOfIssue: extractedDetails.countryOfIssue || extractedDetails.placeOfIssue || prev.countryOfIssue || ''
                        }));

                        setAlertDialog({
                            open: true,
                            title: "Details Extracted",
                            description: "Passport details have been auto-filled from the PDF text. Please verify and update if needed."
                        });
                    } catch (fallbackError) {
                        console.error('Fallback extraction failed:', fallbackError);
                        setAlertDialog({
                            open: true,
                            title: "Extraction Failed",
                            description: fallbackError.message || "Could not extract details from PDF. Please enter details manually."
                        });

                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    }
                } finally {
                    setExtractingPassport(false);
                    setStatusMessage('');
                }
            }
    */




    const validatePassportForm = () => {
        const errors = {};

        if (!passportForm.number || passportForm.number.trim() === '') {
            errors.number = 'Passport number is required';
        }

        if (!passportForm.nationality || passportForm.nationality.trim() === '') {
            errors.nationality = 'Nationality is required';
        }

        if (!passportForm.issueDate || passportForm.issueDate.trim() === '') {
            errors.issueDate = 'Issue date is required';
        }

        if (!passportForm.countryOfIssue || passportForm.countryOfIssue.trim() === '') {
            errors.countryOfIssue = 'Country of issue is required';
        }

        if (!passportForm.expiryDate || passportForm.expiryDate.trim() === '') {
            errors.expiryDate = 'Expiry date is required';
        }

        if (!passportForm.file) {
            errors.file = 'Please upload a passport file';
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
        if (employee?.passportDetails) {
            setPassportForm({
                number: employee.passportDetails.number || '',
                nationality: employee.passportDetails.nationality || '',
                issueDate: employee.passportDetails.issueDate ? employee.passportDetails.issueDate.substring(0, 10) : '',
                expiryDate: employee.passportDetails.expiryDate ? employee.passportDetails.expiryDate.substring(0, 10) : '',
                countryOfIssue: employee.passportDetails.placeOfIssue || '',
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
                nationality: '',
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
        if (!savingPassport && !extractingPassport) {
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

    // Bank Details Modal Handlers
    const handleOpenBankModal = () => {
        if (employee) {
            setBankForm({
                bankName: employee.bankName || employee.bank || '',
                accountName: employee.accountName || employee.bankAccountName || '',
                accountNumber: employee.accountNumber || employee.bankAccountNumber || '',
                ifscCode: employee.ifscCode || employee.swiftCode || employee.ifsc || '',
                otherDetails: employee.bankOtherDetails || employee.otherBankDetails || ''
            });
        } else {
            setBankForm({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ifscCode: '',
                otherDetails: ''
            });
        }
        setShowBankModal(true);
    };

    const handleCloseBankModal = () => {
        if (!savingBank) {
            setShowBankModal(false);
            setBankForm({
                bankName: '',
                accountName: '',
                accountNumber: '',
                ifscCode: '',
                otherDetails: ''
            });
        }
    };

    const handleBankChange = (field, value) => {
        setBankForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSaveBank = async () => {
        if (!employeeId) return;
        try {
            setSavingBank(true);
            const payload = {
                bankName: bankForm.bankName,
                accountName: bankForm.accountName,
                accountNumber: bankForm.accountNumber,
                ifscCode: bankForm.ifscCode,
                bankOtherDetails: bankForm.otherDetails
            };
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, payload);
            await fetchEmployee();
            setShowBankModal(false);
            setAlertDialog({
                open: true,
                title: "Bank details updated",
                description: "Bank details were saved successfully."
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

    const hasContactDetails =
        (Array.isArray(employee?.emergencyContacts) && employee.emergencyContacts.length > 0) ||
        !!(
            (employee?.emergencyContactName && employee.emergencyContactName.trim() !== '') ||
            (employee?.emergencyContactRelation && employee.emergencyContactRelation.trim() !== '') ||
            (employee?.emergencyContactNumber && employee.emergencyContactNumber.trim() !== '')
        );
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
        if (type === 'permanent') {
            setAddressForm({
                line1: employee?.addressLine1 || '',
                line2: employee?.addressLine2 || '',
                city: employee?.city || '',
                state: employee?.state || '',
                country: employee?.country || '',
                postalCode: employee?.postalCode || ''
            });
        } else {
            setAddressForm({
                line1: employee?.currentAddressLine1 || '',
                line2: employee?.currentAddressLine2 || '',
                city: employee?.currentCity || '',
                state: employee?.currentState || '',
                country: employee?.currentCountry || '',
                postalCode: employee?.currentPostalCode || ''
            });
        }
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
    };

    const handleAddressChange = (field, value) => {
        setAddressForm(prev => ({ ...prev, [field]: value }));
    };

    const handleSavePersonalDetails = async () => {
        if (!employeeId) return;
        try {
            setSavingPersonal(true);
            const payload = {
                email: personalForm.email,
                contactNumber: formatPhoneForSave(personalForm.contactNumber),
                dateOfBirth: personalForm.dateOfBirth || null,
                maritalStatus: personalForm.maritalStatus,
                fathersName: personalForm.fathersName,
                gender: personalForm.gender,
                nationality: personalForm.nationality
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
                title: "Reporting authority missing",
                description: "Please assign a reporting authority with a valid email before submitting for approval."
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

    const handleVisaButtonClick = () => {
        if (!isVisaRequirementApplicable) {
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
        if (!isVisaRequirementApplicable) {
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
        if (!isVisaRequirementApplicable) {
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
        setVisaForms(prev => ({
            ...prev,
            [type]: {
                ...prev[type],
                [field]: value
            }
        }));
        if (visaErrors[type]?.[field]) {
            setVisaErrors(prev => ({
                ...prev,
                [type]: { ...prev[type], [field]: '' }
            }));
        }
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
            return;
        }

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
        const requiredFields = ['number', 'issueDate', 'expiryDate'];
        if (type === 'employment' || type === 'spouse') {
            requiredFields.push('sponsor');
        }

        const errors = {};
        requiredFields.forEach((field) => {
            const value = currentForm[field];
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                errors[field] = 'This field is required';
            }
        });
        if (!currentForm.fileBase64) {
            errors.file = 'Visa copy is required';
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

            // Format contact number to ensure it has + prefix if needed
            const formattedContactNumber = editForm.contactNumber
                ? (editForm.contactNumber.startsWith('+')
                    ? editForm.contactNumber
                    : `+${editForm.contactNumber}`)
                : '';

            const updatePayload = {
                employeeId: editForm.employeeId,
                contactNumber: formattedContactNumber,
                email: editForm.email,
                nationality: editForm.nationality,
                country: editForm.nationality,
                status: editForm.status,
                reportingAuthority: editForm.reportingAuthority || null
            };

            // Only include probationPeriod if status is Probation
            if (editForm.status === 'Probation' && editForm.probationPeriod) {
                updatePayload.probationPeriod = editForm.probationPeriod;
            } else if (editForm.status !== 'Probation') {
                updatePayload.probationPeriod = null;
            }

            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, updatePayload);
            await fetchEmployee();
            setShowEditModal(false);
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
    const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 200, height: 200 });
    const [imageScale, setImageScale] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (employeeId) {
            fetchEmployee();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employeeId]);

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
                        const label = `${fullName} – ${emp.designation || emp.role || 'No designation'}`;
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

            const response = await axiosInstance.get(`/Employee/${employeeId}`);
            const data = response.data?.employee || response.data;

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
            setError(err.message || 'Unable to load employee details');
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Calculate profile completion percentage
    const calculateProfileCompletion = () => {
        if (!employee) return 0;

        if (employee.status === 'Probation') {
            let totalSections = 0;
            let completedSections = 0;
            const addSection = (isCompleted, isRequired = true) => {
                if (!isRequired) return;
                totalSections += 1;
                if (isCompleted) completedSections += 1;
            };

            addSection(basicDetailsCompleted());
            addSection(hasPassportSection());
            addSection(hasVisaSection(), !employee?.nationality || employee.nationality.toLowerCase() !== 'uae');
            addSection(hasPersonalDetailsSection());
            addSection(hasEmergencyContactSection());
            addSection(isPermanentAddressComplete());
            addSection(isCurrentAddressComplete());

            if (totalSections === 0) return 0;
            return Math.round((completedSections / totalSections) * 100);
        }

        const fields = [
            employee.firstName, employee.lastName, employee.employeeId, employee.role,
            employee.department, employee.designation, employee.workEmail, employee.contactNumber,
            employee.dateOfJoining, employee.dateOfBirth, employee.gender,
            employee.addressLine1, employee.city, employee.country,
            employee.passportExp, employee.eidExp, employee.medExp
        ];
        const filledFields = fields.filter(field => field && field !== '').length;
        return Math.round((filledFields / fields.length) * 100);
    };

    // Calculate years and months in company
    const calculateTenure = () => {
        if (!employee?.dateOfJoining) return null;
        const joinDate = new Date(employee.dateOfJoining);
        const today = new Date();
        const years = today.getFullYear() - joinDate.getFullYear();
        const months = today.getMonth() - joinDate.getMonth();
        const totalMonths = years * 12 + months;
        const finalYears = Math.floor(totalMonths / 12);
        const finalMonths = totalMonths % 12;
        return { years: finalYears, months: finalMonths };
    };

    // Calculate days until expiry
    const calculateDaysUntilExpiry = (expiryDate) => {
        if (!expiryDate) return null;
        const expiry = new Date(expiryDate);
        const today = new Date();
        const diffTime = expiry - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const getInitials = (firstName, lastName) => {
        const first = firstName?.charAt(0) || '';
        const last = lastName?.charAt(0) || '';
        return (first + last).toUpperCase();
    };

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
                setImagePosition({ x: 0, y: 0 });
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle image drag for positioning
    const handleMouseDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - imagePosition.x,
            y: e.clientY - imagePosition.y
        });
    };

    const handleMouseMove = (e) => {
        if (isDragging) {
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;
            setImagePosition({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Crop and convert image to base64
    const cropImage = () => {
        return new Promise((resolve) => {
            const img = new window.Image();
            img.src = selectedImage;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const outputSize = 400; // Output size
                canvas.width = outputSize;
                canvas.height = outputSize;

                // Container dimensions
                const containerWidth = 600;
                const containerHeight = 384;

                // Calculate displayed image dimensions
                const imgAspect = img.width / img.height;
                const containerAspect = containerWidth / containerHeight;

                let displayWidth, displayHeight;
                if (imgAspect > containerAspect) {
                    displayWidth = containerWidth;
                    displayHeight = containerWidth / imgAspect;
                } else {
                    displayHeight = containerHeight;
                    displayWidth = containerHeight * imgAspect;
                }

                // Apply scale
                const scaledWidth = displayWidth * imageScale;
                const scaledHeight = displayHeight * imageScale;

                // Calculate image position in container
                const imageLeft = (containerWidth - scaledWidth) / 2 + imagePosition.x;
                const imageTop = (containerHeight - scaledHeight) / 2 + imagePosition.y;

                // Crop area center (always at container center)
                const cropCenterX = containerWidth / 2;
                const cropCenterY = containerHeight / 2;
                const cropSize = 200; // Crop circle diameter

                // Calculate relative position from image to crop center
                const relativeX = cropCenterX - imageLeft;
                const relativeY = cropCenterY - imageTop;

                // Convert to source image coordinates
                const sourceX = (relativeX / scaledWidth) * img.width;
                const sourceY = (relativeY / scaledHeight) * img.height;
                const sourceSize = (cropSize / scaledWidth) * img.width;

                // Ensure we don't go out of bounds
                const finalSourceX = Math.max(0, Math.min(sourceX, img.width - sourceSize));
                const finalSourceY = Math.max(0, Math.min(sourceY, img.height - sourceSize));
                const finalSourceSize = Math.min(sourceSize, img.width - finalSourceX, img.height - finalSourceY);

                // Draw cropped image
                ctx.drawImage(
                    img,
                    finalSourceX, finalSourceY, finalSourceSize, finalSourceSize,
                    0, 0, outputSize, outputSize
                );

                canvas.toBlob((blob) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                }, 'image/jpeg', 0.9);
            };
        });
    };

    // Upload cropped image
    const handleUploadImage = async () => {
        try {
            setUploading(true);
            setError('');

            const croppedImage = await cropImage();

            // Send base64 image as profilePicture field
            await axiosInstance.patch(`/Employee/${employeeId}`, {
                profilePicture: croppedImage
            });

            // Refresh employee data
            await fetchEmployee();
            setShowImageModal(false);
            setSelectedImage(null);
            setImageError(false);
        } catch (err) {
            console.error('Error uploading image:', err);
            setError(err.response?.data?.message || err.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const tenure = calculateTenure();
    const profileCompletion = calculateProfileCompletion();
    const isProfileReady = profileCompletion >= 100;
    const approvalStatus = employee?.profileApprovalStatus || 'draft';
    const awaitingApproval = approvalStatus === 'submitted';
    const profileApproved = approvalStatus === 'active';
    const canSendForApproval = approvalStatus === 'draft' && isProfileReady;
    const visaDays = employee?.visaExp ? calculateDaysUntilExpiry(employee.visaExp) : null;
    const eidDays = employee?.eidExp ? calculateDaysUntilExpiry(employee.eidExp) : null;
    const medDays = employee?.medExp ? calculateDaysUntilExpiry(employee.medExp) : null;
    const isVisaRequirementApplicable = !employee?.nationality || employee.nationality.toLowerCase() !== 'uae';

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
        return 'bg-gray-400';
    };

    // Status items for Employment Summary
    const statusItems = [];
    if (tenure) {
        statusItems.push({
            type: 'tenure',
            text: `${tenure.years} Years ${tenure.months} Months in VITS`
        });
    }
    if (visaDays !== null) {
        statusItems.push({
            type: 'visa',
            text: `Visa Expires in ${visaDays} days`
        });
    }
    if (medDays !== null) {
        statusItems.push({
            type: 'medical',
            text: `Medical Insurance Expires in ${medDays} days`
        });
    }
    if (eidDays !== null) {
        statusItems.push({
            type: 'eid',
            text: `Emirates ID expires in ${eidDays} days`
        });
    }

    const InfoRow = ({ label, value }) => (
        <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</span>
            <span className="text-sm text-gray-900">{value || '—'}</span>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-gray-50">
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
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Profile Card */}
                                <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
                                    <div className="flex items-start gap-6">
                                        {/* Profile Picture - Rectangular */}
                                        <div className="relative flex-shrink-0 group">
                                            <div className="w-32 h-40 rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-blue-500 relative">
                                                {(employee.profilePicture || employee.profilePic || employee.avatar) && !imageError ? (
                                                    <Image
                                                        src={employee.profilePicture || employee.profilePic || employee.avatar}
                                                        alt={`${employee.firstName} ${employee.lastName}`}
                                                        fill
                                                        className="object-cover"
                                                        onError={() => setImageError(true)}
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-white text-4xl font-semibold">
                                                        {getInitials(employee.firstName, employee.lastName)}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Online Status Indicator */}
                                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                                            {/* Camera/Edit Button */}
                                            <button
                                                onClick={() => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.onchange = handleFileSelect;
                                                    input.click();
                                                }}
                                                className="absolute top-2 right-2 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100"
                                                title="Change profile picture"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                                    <circle cx="12" cy="13" r="4"></circle>
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h1 className="text-2xl font-bold text-gray-800">
                                                    {employee.firstName} {employee.lastName}
                                                </h1>
                                                {employee.status && (
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${employee.status === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                                            employee.status === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                                                employee.status === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                                                    employee.status === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                                        'bg-gray-100 text-gray-700'
                                                            }`}>
                                                            {employee.status}
                                                        </span>
                                                        {employee.status === 'Probation' && employee.probationPeriod && (
                                                            <span className="px-2 py-1 rounded text-xs font-medium bg-[#3B82F6]/10 text-[#1D4ED8] border border-[#3B82F6]/20">
                                                                {employee.probationPeriod} Month{employee.probationPeriod > 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-gray-600 mb-3">{employee.role || employee.designation || 'Employee'}</p>

                                            {/* Contact Info */}
                                            {(employee.contactNumber || employee.email || employee.workEmail) && (
                                                <div className="space-y-2 mb-4">
                                                    {employee.contactNumber && (
                                                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                                            </svg>
                                                            <span>{employee.contactNumber}</span>
                                                        </div>
                                                    )}
                                                    {(employee.email || employee.workEmail) && (
                                                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                                                                <polyline points="22,6 12,13 2,6"></polyline>
                                                            </svg>
                                                            <span>{employee.email || employee.workEmail}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Profile Status */}
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-medium text-gray-700">Profile Status</span>
                                                    <span className="text-sm font-semibold text-gray-800">{profileCompletion}%</span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2.5">
                                                    <div
                                                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                                                        style={{ width: `${profileCompletion}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-3 flex flex-col gap-2 items-end">
                                                    {canSendForApproval && (
                                                        <div className="w-full max-w-xs flex items-center gap-2">
                                                            <span className="flex-1 text-xs font-medium text-gray-600 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                                                                Ready to notify the reporting authority.
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSubmitForApproval();
                                                                }}
                                                                disabled={sendingApproval}
                                                                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-green-500 text-white hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                {sendingApproval ? 'Sending...' : 'Send for Activation'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {awaitingApproval && (
                                                        <div className="w-full max-w-xs flex items-center gap-2">
                                                            <span className="flex-1 text-xs font-medium text-gray-600 bg-yellow-50 border border-yellow-200 px-3 py-2 rounded-lg">
                                                                Request sent. Awaiting reporting authority activation.
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleActivateProfile();
                                                                }}
                                                                disabled={activatingProfile}
                                                                className="px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                            >
                                                                {activatingProfile ? 'Activating...' : 'Activate Profile'}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {profileApproved && (
                                                        <div className="w-full max-w-xs flex justify-end">
                                                            <span className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-700 border border-green-200">
                                                                Profile activated
                                                            </span>
                                                        </div>
                                                    )}
                                                    {!profileApproved && !canSendForApproval && !awaitingApproval && (
                                                        <p className="text-xs text-gray-500">
                                                            Complete the required sections to reach 100% and enable activation.
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Employment Summary Card */}
                                <div className="relative rounded-lg overflow-hidden shadow-sm text-white">
                                    <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-sky-500 to-sky-400"></div>
                                    <div className="absolute -left-24 -bottom-24 w-64 h-64 bg-blue-700/40 rounded-full"></div>
                                    <div className="absolute -right-16 -top-16 w-48 h-48 bg-sky-300/30 rounded-full"></div>

                                    <div className="relative p-6">
                                        <h2 className="text-2xl font-semibold mb-4">Employment Summary</h2>
                                        <div className="flex items-start gap-6">
                                            {/* Tie Icon Image */}
                                            <div
                                                className="relative flex-shrink-0"
                                                style={{ width: '93px', height: '177px' }}
                                            >
                                                <Image
                                                    src="/assets/employee/tie-img.png"
                                                    alt="Employment Summary"
                                                    fill
                                                    className="object-contain"
                                                    priority
                                                    sizes="93px"
                                                    unoptimized
                                                />
                                            </div>

                                            {/* Status List */}
                                            <div className="flex-1 space-y-3">
                                                {statusItems.map((item, index) => (
                                                    <div key={index} className="flex items-center gap-3">
                                                        <div className={`w-3 h-3 rounded-full ${getStatusColor(item.type)}`} />
                                                        <p className="text-white text-base">{item.text}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Main Tabs */}
                            <div className=" rounded-lg shadow-sm">
                                <div className="px-6 pt-4">
                                    <div className="rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between bg-transparent">
                                        <div className="flex items-center gap-6 text-sm font-semibold">
                                            <button
                                                onClick={() => { setActiveTab('basic'); setActiveSubTab('basic-details'); }}
                                                className={`relative pb-2 transition-colors ${activeTab === 'basic'
                                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                Basic Details
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('salary')}
                                                className={`relative pb-2 transition-colors ${activeTab === 'salary'
                                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                Salary
                                            </button>
                                            <button
                                                onClick={() => setActiveTab('personal')}
                                                className={`relative pb-2 transition-colors ${activeTab === 'personal'
                                                    ? 'text-blue-600 after:content-[\'\'] after:absolute after:left-0 after:-bottom-1 after:w-full after:h-0.5 after:bg-blue-500'
                                                    : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                Personal Information
                                            </button>
                                        </div>
                                        <button className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-md flex items-center gap-2 shadow-sm">
                                            Add More
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="6 9 12 15 18 9"></polyline>
                                            </svg>
                                        </button>
                                    </div>
                                </div>

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
                                                    {/* Row 1: Basic Details and Passport */}
                                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                        {/* Basic Details Card */}
                                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                <h3 className="text-xl font-semibold text-gray-800">Basic Details</h3>
                                                                <button
                                                                    onClick={openEditModal}
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
                                                                    { label: 'Employee ID', value: employee.employeeId },
                                                                    { label: 'Contact Number', value: employee.contactNumber },
                                                                    { label: 'Email', value: employee.email || employee.workEmail },
                                                                    { label: 'Nationality', value: employee.nationality || employee.country },
                                                                    { label: 'Reportee Name', value: reportingAuthorityValueForDisplay }
                                                                ]
                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                    .map((row, index, arr) => (
                                                                        <div
                                                                            key={row.label}
                                                                            className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                        >
                                                                            <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                            <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        </div>

                                                        {/* Passport Card - Show only if data exists */}
                                                        {employee.passportDetails?.number && (
                                                            <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                    <h3 className="text-xl font-semibold text-gray-800">Passport Details</h3>
                                                                    <button
                                                                        onClick={handleOpenPassportModal}
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
                                                                        { label: 'Passport Number', value: employee.passportDetails.number },
                                                                        { label: 'Issue Date', value: employee.passportDetails.issueDate ? formatDate(employee.passportDetails.issueDate) : null },
                                                                        { label: 'Expiry Date', value: employee.passportDetails.expiryDate ? formatDate(employee.passportDetails.expiryDate) : null },
                                                                        { label: 'Place of Issue', value: employee.passportDetails.placeOfIssue }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row, index, arr) => (
                                                                            <div
                                                                                key={row.label}
                                                                                className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                            >
                                                                                <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                                <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Row 2: Visa Card */}
                                                    {(employee.visaDetails?.visit?.number ||
                                                        employee.visaDetails?.employment?.number ||
                                                        employee.visaDetails?.spouse?.number) && (
                                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                                        <h3 className="text-xl font-semibold text-gray-800">Visa Details</h3>
                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={() => handleOpenVisaModal()}
                                                                                className="text-blue-600 hover:text-blue-700"
                                                                            >
                                                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                                </svg>
                                                                            </button>
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
                                                                                    { label: 'Visit Visa Number', value: employee.visaDetails.visit.number },
                                                                                    { label: 'Visit Visa Issue Date', value: employee.visaDetails.visit.issueDate ? formatDate(employee.visaDetails.visit.issueDate) : null },
                                                                                    { label: 'Visit Visa Expiry Date', value: employee.visaDetails.visit.expiryDate ? formatDate(employee.visaDetails.visit.expiryDate) : null },
                                                                                    { label: 'Visit Visa Sponsor', value: employee.visaDetails.visit.sponsor }
                                                                                ]
                                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                                    .map((row, index, arr) => (
                                                                                        <div
                                                                                            key={row.label}
                                                                                            className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                                        >
                                                                                            <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                                            <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </>
                                                                        )}

                                                                        {/* Employment Visa */}
                                                                        {employee.visaDetails?.employment?.number && (
                                                                            <>
                                                                                {employee.visaDetails?.visit?.number && <div className="border-t border-gray-200"></div>}
                                                                                {[
                                                                                    { label: 'Employment Visa Number', value: employee.visaDetails.employment.number },
                                                                                    { label: 'Employment Visa Issue Date', value: employee.visaDetails.employment.issueDate ? formatDate(employee.visaDetails.employment.issueDate) : null },
                                                                                    { label: 'Employment Visa Expiry Date', value: employee.visaDetails.employment.expiryDate ? formatDate(employee.visaDetails.employment.expiryDate) : null },
                                                                                    { label: 'Employment Visa Sponsor', value: employee.visaDetails.employment.sponsor }
                                                                                ]
                                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                                    .map((row, index, arr) => (
                                                                                        <div
                                                                                            key={row.label}
                                                                                            className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                                        >
                                                                                            <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                                            <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </>
                                                                        )}

                                                                        {/* Spouse Visa */}
                                                                        {employee.visaDetails?.spouse?.number && (
                                                                            <>
                                                                                {(employee.visaDetails?.visit?.number || employee.visaDetails?.employment?.number) && <div className="border-t border-gray-200"></div>}
                                                                                {[
                                                                                    { label: 'Spouse Visa Number', value: employee.visaDetails.spouse.number },
                                                                                    { label: 'Spouse Visa Issue Date', value: employee.visaDetails.spouse.issueDate ? formatDate(employee.visaDetails.spouse.issueDate) : null },
                                                                                    { label: 'Spouse Visa Expiry Date', value: employee.visaDetails.spouse.expiryDate ? formatDate(employee.visaDetails.spouse.expiryDate) : null },
                                                                                    { label: 'Spouse Visa Sponsor', value: employee.visaDetails.spouse.sponsor }
                                                                                ]
                                                                                    .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                                    .map((row, index, arr) => (
                                                                                        <div
                                                                                            key={row.label}
                                                                                            className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                                        >
                                                                                            <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                                            <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                                        </div>
                                                                                    ))}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                    {/* Document Tags - Show only buttons for documents that don't have data */}
                                                    <div className="flex flex-wrap gap-4 mt-6">
                                                        {/* Passport button - only show if passport data doesn't exist */}
                                                        {!employee.passportDetails?.number && (
                                                            <button
                                                                onClick={handleOpenPassportModal}
                                                                className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                            >
                                                                Passport
                                                                <span className="text-lg leading-none">+</span>
                                                            </button>
                                                        )}
                                                        {/* Visa button - only show if visa data doesn't exist and nationality is not UAE */}
                                                        {isVisaRequirementApplicable &&
                                                            !employee.visaDetails?.visit?.number &&
                                                            !employee.visaDetails?.employment?.number &&
                                                            !employee.visaDetails?.spouse?.number && (
                                                                <div className="relative">
                                                                    <button
                                                                        onClick={handleVisaButtonClick}
                                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                                    >
                                                                        Visa
                                                                        <span className="text-lg leading-none">+</span>
                                                                    </button>
                                                                    {showVisaDropdown && (
                                                                        <div className="absolute left-0 z-20 mt-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                                                                            {visaTypes.map((type) => (
                                                                                <button
                                                                                    key={type.key}
                                                                                    onClick={() => handleVisaDropdownChange(type.key)}
                                                                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                                                                >
                                                                                    {type.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        {/* Other document buttons - always show */}
                                                        {['Emirates ID', 'Labour Card', 'Medical Insurance', 'Driving Licence'].map((doc) => (
                                                            <button
                                                                key={doc}
                                                                className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                            >
                                                                {doc}
                                                                <span className="text-lg leading-none">+</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {activeSubTab === 'education' && (
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Education</h3>
                                                    <p className="text-gray-500">Education information will be displayed here.</p>
                                                </div>
                                            )}

                                            {activeSubTab === 'experience' && (
                                                <div>
                                                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Experience</h3>
                                                    <p className="text-gray-500">Experience information will be displayed here.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'salary' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                {/* Salary Details Card */}
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                        <h3 className="text-xl font-semibold text-gray-800">Salary Details</h3>
                                                        <button
                                                            onClick={() => {
                                                                // TODO: Open edit modal for salary details
                                                                console.log('Edit salary details');
                                                            }}
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
                                                            { label: 'Basic Salary', value: employee.basic ? `AED ${employee.basic.toFixed(2)}` : 'AED 0.00' },
                                                            { label: 'Home Rent Allowance', value: employee.houseRentAllowance ? `AED ${employee.houseRentAllowance.toFixed(1)}` : 'AED 0.0' },
                                                            {
                                                                label: 'Vehicle Allowance',
                                                                value: employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount
                                                                    ? `${employee.additionalAllowances.find(a => a.type?.toLowerCase().includes('vehicle')).amount}`
                                                                    : '0'
                                                            },
                                                            { label: 'Other Allowance', value: employee.otherAllowance ? `AED ${employee.otherAllowance.toFixed(2)}` : 'AED 0.00' },
                                                            {
                                                                label: 'Total Salary',
                                                                value: (() => {
                                                                    const basic = employee.basic || 0;
                                                                    const hra = employee.houseRentAllowance || 0;
                                                                    const other = employee.otherAllowance || 0;
                                                                    const vehicle = employee.additionalAllowances?.find(a => a.type?.toLowerCase().includes('vehicle'))?.amount || 0;
                                                                    const additionalTotal = (employee.additionalAllowances || []).reduce((sum, item) => sum + (item.amount || 0), 0);
                                                                    const total = basic + hra + other + additionalTotal;
                                                                    return `AED ${total.toFixed(2)}`;
                                                                })(),
                                                                isTotal: true
                                                            }
                                                        ]
                                                            .map((row, index, arr) => (
                                                                <div
                                                                    key={row.label}
                                                                    className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''} ${row.isTotal ? 'bg-gray-50 font-semibold' : ''}`}
                                                                >
                                                                    <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                    <span className={`w-full md:w-1/2 mt-1 md:mt-0 ${row.isTotal ? 'text-gray-900' : 'text-gray-800'}`}>{row.value}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* Bank Details Card - Always show */}
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                        <h3 className="text-xl font-semibold text-gray-800">Bank Details</h3>
                                                        <button
                                                            onClick={handleOpenBankModal}
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
                                                            { label: 'Bank', value: employee.bankName || employee.bank },
                                                            { label: 'Account Name', value: employee.accountName || employee.bankAccountName },
                                                            { label: 'Number', value: employee.accountNumber || employee.bankAccountNumber },
                                                            { label: 'IFSC / SWIFT', value: employee.ifscCode || employee.swiftCode || employee.ifsc },
                                                            { label: 'Other Details (if any)', value: employee.bankOtherDetails || employee.otherBankDetails }
                                                        ]
                                                            .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                            .map((row, index, arr) => (
                                                                <div
                                                                    key={row.label}
                                                                    className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                >
                                                                    <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                    <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                </div>
                                                            ))}
                                                        {!(employee.bankName || employee.bank || employee.accountName || employee.bankAccountName || employee.accountNumber || employee.bankAccountNumber || employee.ifscCode || employee.swiftCode || employee.ifsc || employee.bankOtherDetails || employee.otherBankDetails) && (
                                                            <div className="px-6 py-8 text-center text-gray-400 text-sm">
                                                                No bank details available
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Action Buttons - Tab Style */}
                                            <div className="flex flex-wrap gap-2 mt-6">
                                                {['Salary History', 'Fine', 'Rewards', 'NCR', 'Loans', 'CTC'].map((action) => (
                                                    <button
                                                        key={action}
                                                        onClick={() => setSelectedSalaryAction(action)}
                                                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedSalaryAction === action
                                                            ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        {action}
                                                    </button>
                                                ))}
                                            </div>

                                            {/* Salary Action Card */}
                                            <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-xl font-semibold text-gray-800">{selectedSalaryAction}</h3>
                                                    <button
                                                        onClick={() => {
                                                            console.log(`Add ${selectedSalaryAction}`);
                                                        }}
                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                    >
                                                        Add {selectedSalaryAction === 'Salary History' ? 'Salary' : selectedSalaryAction === 'Rewards' ? 'Reward' : selectedSalaryAction.slice(0, -1)}
                                                        <span className="text-lg leading-none">+</span>
                                                    </button>
                                                </div>

                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm text-gray-600">Show</span>
                                                        <select className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                                            <option>2</option>
                                                            <option>5</option>
                                                            <option>10</option>
                                                            <option>20</option>
                                                        </select>
                                                        <span className="text-sm text-gray-600">/ Page</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                                                            &lt;
                                                        </button>
                                                        <button className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm">2</button>
                                                        <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">3</button>
                                                        <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">4</button>
                                                        <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                                                            &gt;
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto">
                                                    <table className="w-full">
                                                        <thead>
                                                            <tr className="border-b border-gray-200">
                                                                {selectedSalaryAction === 'Salary History' && (
                                                                    <>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Month</th>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Basic Salary</th>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Other Allowance</th>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Home Rent Allowance</th>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Vehicle Allowance</th>
                                                                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total Salary</th>
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
                                                            <tr>
                                                                <td colSpan={selectedSalaryAction === 'Salary History' ? 7 : 4} className="py-16 text-center text-gray-400 text-sm">
                                                                    {selectedSalaryAction === 'Salary History'
                                                                        ? 'No Salary History'
                                                                        : `No ${selectedSalaryAction} data available`}
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                        </div>
                                    )}

                                    {activeTab === 'personal' && (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                                                {/* Personal Details Card */}
                                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
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
                                                            { label: 'Father’s Name', value: employee.fathersName }
                                                        ]
                                                            .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                            .map((row, index, arr) => (
                                                                <div
                                                                    key={row.label}
                                                                    className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                >
                                                                    <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                    <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                </div>
                                                            ))}
                                                    </div>
                                                </div>

                                                {/* Permanent Address Card */}
                                                {hasPermanentAddress ? (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Permanent Address</h3>
                                                            <button
                                                                onClick={() => handleOpenAddressModal('permanent')}
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
                                                                {
                                                                    label: 'Address',
                                                                    value: employee.addressLine1 && employee.addressLine2
                                                                        ? `${employee.addressLine1}, ${employee.addressLine2}`
                                                                        : employee.addressLine1 || employee.addressLine2
                                                                },
                                                                { label: 'State', value: employee.state },
                                                                { label: 'Country', value: employee.country },
                                                                { label: 'ZIP Code', value: employee.postalCode }
                                                            ]
                                                                .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                .map((row, index, arr) => (
                                                                    <div
                                                                        key={row.label}
                                                                        className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                    >
                                                                        <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                        <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Current Address Card */}
                                                {hasCurrentAddress ? (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Current Address</h3>
                                                            <button
                                                                onClick={() => handleOpenAddressModal('current')}
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
                                                                {
                                                                    label: 'Address',
                                                                    value: employee.currentAddressLine1 && employee.currentAddressLine2
                                                                        ? `${employee.currentAddressLine1}, ${employee.currentAddressLine2}`
                                                                        : employee.currentAddressLine1 || employee.currentAddressLine2
                                                                },
                                                                { label: 'Emirate', value: employee.currentState },
                                                                { label: 'Country', value: employee.currentCountry },
                                                                { label: 'ZIP Code', value: employee.currentPostalCode }
                                                            ]
                                                                .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                .map((row, index, arr) => (
                                                                    <div
                                                                        key={row.label}
                                                                        className={`flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600 ${index !== arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                                                                    >
                                                                        <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                        <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </div>
                                                ) : null}

                                                {/* Contact Details Card */}
                                                {hasContactDetails && (
                                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
                                                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                                            <h3 className="text-xl font-semibold text-gray-800">Emergency Contact</h3>
                                                            <button
                                                                onClick={() => handleOpenContactModal()}
                                                                className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                            >
                                                                Add Emergency Contact
                                                                <span className="text-base leading-none">+</span>
                                                            </button>
                                                        </div>
                                                        <div>
                                                            {employee.emergencyContacts?.length ? (
                                                                employee.emergencyContacts.map((contact, index) => (
                                                                    <div key={contact._id || index} className="border-b border-gray-100 last:border-b-0">
                                                                        <div className="flex items-center justify-between px-6 py-3 text-blue-600 text-sm font-semibold">
                                                                            <span>Contact {index + 1}</span>
                                                                            <div className="flex items-center gap-3">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleOpenContactModal(contact._id, index);
                                                                                    }}
                                                                                    className="text-gray-400 hover:text-blue-600"
                                                                                >
                                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                                    </svg>
                                                                                </button>
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDeleteContact(contact._id, index);
                                                                                    }}
                                                                                    disabled={deletingContactId === (contact._id || `legacy-${index}`)}
                                                                                    className="text-red-500 hover:text-red-600 text-xs font-semibold disabled:opacity-60"
                                                                                >
                                                                                    {deletingContactId === (contact._id || `legacy-${index}`) ? 'Removing...' : 'Remove'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                        {[
                                                                            { label: 'Name', value: contact.name },
                                                                            { label: 'Phone Number', value: contact.number },
                                                                            {
                                                                                label: 'Relation',
                                                                                value: contact.relation
                                                                                    ? contact.relation.charAt(0).toUpperCase() + contact.relation.slice(1)
                                                                                    : null
                                                                            }
                                                                        ]
                                                                            .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                            .map((row) => (
                                                                                <div
                                                                                    key={`${index}-${row.label}`}
                                                                                    className="flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600"
                                                                                >
                                                                                    <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                                    <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                                </div>
                                                                            ))}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="border-b border-gray-100 last:border-b-0">
                                                                    <div className="flex items-center justify-between px-6 py-3 text-blue-600 text-sm font-semibold">
                                                                        <span>Contact 1</span>
                                                                        <div className="flex items-center gap-3">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleOpenContactModal(null, 0);
                                                                                }}
                                                                                className="text-gray-400 hover:text-blue-600"
                                                                            >
                                                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                                                </svg>
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleDeleteContact(null, 0);
                                                                                }}
                                                                                disabled={deletingContactId === 'legacy-0'}
                                                                                className="text-red-500 hover:text-red-600 text-xs font-semibold disabled:opacity-60"
                                                                            >
                                                                                {deletingContactId === 'legacy-0' ? 'Removing...' : 'Remove'}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    {[
                                                                        { label: 'Name', value: employee.emergencyContactName },
                                                                        { label: 'Phone Number', value: employee.emergencyContactNumber },
                                                                        {
                                                                            label: 'Relation',
                                                                            value: employee.emergencyContactRelation
                                                                                ? employee.emergencyContactRelation.charAt(0).toUpperCase() + employee.emergencyContactRelation.slice(1)
                                                                                : null
                                                                        }
                                                                    ]
                                                                        .filter(row => row.value && row.value !== '—' && row.value.trim() !== '')
                                                                        .map((row) => (
                                                                            <div
                                                                                key={`legacy-${row.label}`}
                                                                                className="flex flex-col md:flex-row md:items-center px-6 py-4 text-sm font-medium text-gray-600"
                                                                            >
                                                                                <span className="w-full md:w-1/2 text-gray-500">{row.label}</span>
                                                                                <span className="w-full md:w-1/2 text-gray-800 mt-1 md:mt-0">{row.value}</span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Buttons - Outside the cards */}
                                            <div className="flex flex-wrap gap-4 mt-6">
                                                {!hasCurrentAddress && (
                                                    <button
                                                        onClick={() => handleOpenAddressModal('current')}
                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                    >
                                                        Current Address
                                                        <span className="text-lg leading-none">+</span>
                                                    </button>
                                                )}

                                                {!hasPermanentAddress && (
                                                    <button
                                                        onClick={() => handleOpenAddressModal('permanent')}
                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                    >
                                                        Permanent Address
                                                        <span className="text-lg leading-none">+</span>
                                                    </button>
                                                )}

                                                {!hasContactDetails && (
                                                    <button
                                                        onClick={() => handleOpenContactModal()}
                                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                    >
                                                        Emergency Contact
                                                        <span className="text-lg leading-none">+</span>
                                                    </button>
                                                )}

                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Image Upload and Crop Modal */}
                    {showImageModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-xl font-semibold text-gray-800">Crop Profile Picture</h2>
                                        <button
                                            onClick={() => {
                                                setShowImageModal(false);
                                                setSelectedImage(null);
                                            }}
                                            className="text-gray-500 hover:text-gray-700"
                                        >
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                                <line x1="6" y1="6" x2="18" y2="18"></line>
                                            </svg>
                                        </button>
                                    </div>

                                    {selectedImage && (
                                        <div className="mb-4">
                                            <div className="relative w-full h-96 bg-gray-100 rounded-lg overflow-hidden mb-4" style={{ position: 'relative' }}>
                                                {/* Dark overlay with circular cutout */}
                                                <div
                                                    className="absolute inset-0"
                                                    style={{
                                                        background: 'rgba(0, 0, 0, 0.5)',
                                                        clipPath: `circle(100px at 50% 50%)`,
                                                        pointerEvents: 'none'
                                                    }}
                                                />

                                                {/* Crop Area Indicator */}
                                                <div
                                                    className="absolute border-2 border-blue-500 rounded-full pointer-events-none z-10"
                                                    style={{
                                                        left: '50%',
                                                        top: '50%',
                                                        width: '200px',
                                                        height: '200px',
                                                        transform: 'translate(-50%, -50%)',
                                                        boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.5)'
                                                    }}
                                                >
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                                    </div>
                                                </div>

                                                {/* Image Container */}
                                                <div
                                                    className="absolute inset-0 flex items-center justify-center"
                                                    style={{
                                                        transform: `scale(${imageScale}) translate(${imagePosition.x / imageScale}px, ${imagePosition.y / imageScale}px)`,
                                                        transformOrigin: 'center center',
                                                        cursor: isDragging ? 'grabbing' : 'grab'
                                                    }}
                                                    onMouseDown={handleMouseDown}
                                                >
                                                    <img
                                                        src={selectedImage}
                                                        alt="Preview"
                                                        className="max-w-full max-h-full object-contain select-none"
                                                        draggable={false}
                                                        style={{ userSelect: 'none' }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Controls */}
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                                        Zoom: {Math.round(imageScale * 100)}%
                                                    </label>
                                                    <input
                                                        type="range"
                                                        min="0.5"
                                                        max="3"
                                                        step="0.1"
                                                        value={imageScale}
                                                        onChange={(e) => setImageScale(parseFloat(e.target.value))}
                                                        className="w-full"
                                                    />
                                                </div>

                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => {
                                                            const input = document.createElement('input');
                                                            input.type = 'file';
                                                            input.accept = 'image/*';
                                                            input.onchange = handleFileSelect;
                                                            input.click();
                                                        }}
                                                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                                    >
                                                        Change Image
                                                    </button>
                                                    <button
                                                        onClick={handleUploadImage}
                                                        disabled={uploading}
                                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    )}

                    {/* Edit Basic Details Modal */}
                    {showEditModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/40" onClick={() => !updating && setShowEditModal(false)}></div>
                            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                    <h3 className="text-[22px] font-semibold text-gray-800">Basic Details</h3>
                                    <button
                                        onClick={() => !updating && setShowEditModal(false)}
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
                                            { label: 'Contact Number', field: 'contactNumber', type: 'text' },
                                            { label: 'Email', field: 'email', type: 'email' },
                                            { label: 'Nationality', field: 'nationality', type: 'text' },
                                            { label: 'Status', field: 'status', type: 'select' }
                                        ].map((input) => (
                                            <div key={input.field} className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">{input.label}</label>
                                                {input.type === 'select' ? (
                                                    <select
                                                        value={editForm[input.field] || employee?.status || 'Probation'}
                                                        onChange={(e) => handleEditChange(input.field, e.target.value)}
                                                        className="w-full md:flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                        disabled={updating}
                                                    >
                                                        {['Probation', 'Permanent', 'Temporary', 'Notice'].map((option) => (
                                                            <option
                                                                key={option}
                                                                value={option}
                                                                disabled={option === 'Notice' && (employee?.status === 'Probation')}
                                                            >
                                                                {option}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type={input.type}
                                                        value={editForm[input.field]}
                                                        onChange={(e) => handleEditChange(input.field, e.target.value)}
                                                        className="w-full md:flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                        disabled={updating || input.readOnly}
                                                        readOnly={input.readOnly}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">Reporting Authority</label>
                                            <div className="w-full md:flex-1 flex flex-col gap-1">
                                                <select
                                                    value={editForm.reportingAuthority || ''}
                                                    onChange={(e) => handleEditChange('reportingAuthority', e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                    disabled={updating || reportingAuthorityLoading}
                                                >
                                                    <option value="">{reportingAuthorityLoading ? 'Loading...' : 'Select reporting authority'}</option>
                                                    {reportingAuthorityOptions.map((option) => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                {reportingAuthorityError && (
                                                    <span className="text-xs text-red-500">{reportingAuthorityError}</span>
                                                )}
                                            </div>
                                        </div>
                                        {/* Probation Period - only show when status is Probation */}
                                        {editForm.status === 'Probation' && (
                                            <div className="flex flex-col md:flex-row md:items-center gap-3 border border-gray-100 rounded-2xl px-4 py-2.5 bg-white">
                                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3">Probation Period (Months)</label>
                                                <select
                                                    value={editForm.probationPeriod || ''}
                                                    onChange={(e) => handleEditChange('probationPeriod', e.target.value ? parseInt(e.target.value) : null)}
                                                    className="w-full md:flex-1 h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                    disabled={updating}
                                                >
                                                    <option value="">Select Probation Period</option>
                                                    {[1, 2, 3, 4, 5, 6].map((month) => (
                                                        <option key={month} value={month}>
                                                            {month} Month{month > 1 ? 's' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-4 px-4 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => !updating && setShowEditModal(false)}
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
                    )}

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
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
                                <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogAction onClick={() => setAlertDialog((prev) => ({ ...prev, open: false }))}>
                                    Close
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    {/* Passport Modal */}
                    {showPassportModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/40" onClick={handleClosePassportModal}></div>
                            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                    <h3 className="text-[22px] font-semibold text-gray-800">Passport Details</h3>
                                    <button
                                        onClick={handleClosePassportModal}
                                        className="absolute right-0 text-gray-400 hover:text-gray-600"
                                        disabled={savingPassport || extractingPassport}
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
                                                        disabled={savingPassport || extractingPassport || input.readOnly}
                                                        readOnly={input.readOnly}
                                                    />
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
                                                    disabled={savingPassport || extractingPassport}
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
                                                {/* Extraction UI commented out - extraction is disabled
                                                {extractingPassport && (
                                                    <div className="flex flex-col gap-1">
                                                        <p className="text-sm text-blue-600">Extracting details from document...</p>
                                                        {statusMessage && (
                                                            <p className="text-xs text-blue-500">{statusMessage}</p>
                                                        )}
                                                    </div>
                                                )}
                                                */}
                                                <p className="text-xs text-gray-500">Upload file in JPEG / PDF format</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                                    <button
                                        onClick={handleClosePassportModal}
                                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                                        disabled={savingPassport || extractingPassport}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePassportSubmit}
                                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                                        disabled={savingPassport || extractingPassport}
                                    >
                                        {savingPassport ? 'Updating...' : extractingPassport ? 'Extracting...' : 'Update'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Visa Modal */}
                    {showVisaModal && selectedVisaType && (
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
                                                            onChange={(e) => handleVisaFieldChange(selectedVisaType, input.field, e.target.value)}
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
                    )}

                    {/* Bank Details Modal */}
                    {showBankModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-black/40" onClick={handleCloseBankModal}></div>
                            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                                    <h3 className="text-[22px] font-semibold text-gray-800">Bank Details</h3>
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
                                            { label: 'Bank Name', field: 'bankName', type: 'text', required: true },
                                            { label: 'Account Name', field: 'accountName', type: 'text', required: true },
                                            { label: 'Account Number', field: 'accountNumber', type: 'text', required: true },
                                            { label: 'IFSC / SWIFT Code', field: 'ifscCode', type: 'text', required: false },
                                            { label: 'Other Details (if any)', field: 'otherDetails', type: 'text', required: false }
                                        ].map((input) => (
                                            <div key={input.field} className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                                <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                                    {input.label} {input.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <div className="w-full md:flex-1 flex flex-col gap-1">
                                                    <input
                                                        type={input.type}
                                                        value={bankForm[input.field]}
                                                        onChange={(e) => handleBankChange(input.field, e.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                        placeholder={`Enter ${input.label.toLowerCase()}`}
                                                        disabled={savingBank}
                                                    />
                                                </div>
                                            </div>
                                        ))}
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
                    )}

                    {/* Contact Details Modal */}
                    {showContactModal && (
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
                                                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                    placeholder="Enter contact name"
                                                    disabled={savingContact}
                                                />
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <span className="text-xs font-semibold text-gray-500">Relation</span>
                                                <select
                                                    value={activeContactForm.relation}
                                                    onChange={(e) => handleContactChange(0, 'relation', e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                    disabled={savingContact}
                                                >
                                                    {['Self', 'Father', 'Mother', 'Friend', 'Spouse', 'Other'].map((option) => (
                                                        <option key={option} value={option}>
                                                            {option}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2 md:col-span-2">
                                                <span className="text-xs font-semibold text-gray-500">Phone Number</span>
                                                <PhoneInput
                                                    country={DEFAULT_PHONE_COUNTRY}
                                                    value={activeContactForm.number}
                                                    onChange={(value) => handleContactChange(0, 'number', value)}
                                                    enableSearch
                                                    inputStyle={{
                                                        width: '100%',
                                                        height: '42px',
                                                        borderRadius: '0.75rem',
                                                        borderColor: '#E5E7EB'
                                                    }}
                                                    buttonStyle={{
                                                        borderTopLeftRadius: '0.75rem',
                                                        borderBottomLeftRadius: '0.75rem',
                                                        borderColor: '#E5E7EB',
                                                        backgroundColor: '#fff'
                                                    }}
                                                    dropdownStyle={{ borderRadius: '0.75rem' }}
                                                    placeholder="Enter contact number"
                                                    disabled={savingContact}
                                                />
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
                    )}


                    {/* Personal Details Modal */}
                    {showPersonalModal && (
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
                                        { label: 'Date of Birth', field: 'dateOfBirth', type: 'date', required: false },
                                        { label: 'Marital Status', field: 'maritalStatus', type: 'text', required: false },
                                        { label: 'Father’s Name', field: 'fathersName', type: 'text', required: false },
                                        { label: 'Gender', field: 'gender', type: 'text', required: true },
                                        { label: 'Nationality', field: 'nationality', type: 'text', required: false }
                                    ].map((input) => (
                                        <div key={input.field} className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555]">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {input.type === 'phone' ? (
                                                <PhoneInput
                                                    country={DEFAULT_PHONE_COUNTRY}
                                                    value={personalForm.contactNumber}
                                                    onChange={(value) => handlePersonalChange('contactNumber', value)}
                                                    enableSearch
                                                    inputStyle={{
                                                        width: '100%',
                                                        height: '42px',
                                                        borderRadius: '0.75rem',
                                                        borderColor: '#E5E7EB'
                                                    }}
                                                    buttonStyle={{
                                                        borderTopLeftRadius: '0.75rem',
                                                        borderBottomLeftRadius: '0.75rem',
                                                        borderColor: '#E5E7EB',
                                                        backgroundColor: '#fff'
                                                    }}
                                                    dropdownStyle={{ borderRadius: '0.75rem' }}
                                                    placeholder="Enter contact number"
                                                    disabled={savingPersonal}
                                                />
                                            ) : (
                                                <input
                                                    type={input.type}
                                                    value={personalForm[input.field]}
                                                    onChange={(e) => handlePersonalChange(input.field, e.target.value)}
                                                    className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                    placeholder={`Enter ${input.label.toLowerCase()}`}
                                                    disabled={savingPersonal}
                                                />
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
                    )}


                    {/* Address Modal */}
                    {showAddressModal && (
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
                                        { label: 'Address Line 1', field: 'line1', type: 'text', required: true },
                                        { label: 'Address Line 2', field: 'line2', type: 'text', required: false },
                                        { label: 'City', field: 'city', type: 'text', required: true },
                                        { label: addressModalType === 'permanent' ? 'State' : 'Emirate', field: 'state', type: 'text', required: true },
                                        { label: 'Country', field: 'country', type: 'text', required: true },
                                        { label: 'Postal Code', field: 'postalCode', type: 'text', required: true }
                                    ].map((input) => (
                                        <div key={input.field} className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                            <label className="text-[14px] font-medium text-[#555555]">
                                                {input.label} {input.required && <span className="text-red-500">*</span>}
                                            </label>
                                            <input
                                                type={input.type}
                                                value={addressForm[input.field]}
                                                onChange={(e) => handleAddressChange(input.field, e.target.value)}
                                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                                placeholder={`Enter ${input.label.toLowerCase()}`}
                                                disabled={savingAddress}
                                            />
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
                    )}
                </div>
            </div>

            {/* Mouse event listeners for dragging */}
            {showImageModal && (
                <>
                    <div
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        className="fixed inset-0 z-40"
                    />
                </>
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

