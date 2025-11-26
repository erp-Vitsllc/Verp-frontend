'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import axiosInstance from '@/utils/axios';
// Mindee API configuration - Get free API key at https://developers.mindee.com/
// Note: In Next.js, NEXT_PUBLIC_* env vars are embedded at build time
// You MUST restart the dev server after changing .env.local
const MINDEE_PASSPORT_URL = 'https://api.mindee.net/v1/products/mindee/passport/v1/predict';

// Debug: Log API key status (only first few chars for security)
if (typeof window !== 'undefined') {
    const apiKey = process.env.NEXT_PUBLIC_MINDEE_API_KEY || '';
    console.log('🔑 Mindee API Key Status:', {
        exists: !!apiKey,
        length: apiKey?.length || 0,
        preview: apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET',
        format: apiKey?.startsWith('md_') ? '✅ Correct format' : '❌ Wrong format'
    });

    if (!apiKey || apiKey.length < 10) {
        console.warn('⚠️ Mindee API key not found! Make sure:');
        console.warn('   1. NEXT_PUBLIC_MINDEE_API_KEY is set in .env.local');
        console.warn('   2. You have RESTARTED the Next.js dev server');
        console.warn('   3. The API key is enabled for Passport OCR in Mindee dashboard');
    }
}
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

    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState('basic');
    const [activeSubTab, setActiveSubTab] = useState('basic-details');
    const [imageError, setImageError] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState({
        employeeId: '',
        contactNumber: '',
        personalEmail: '',
        email: '',
        nationality: '',
        status: ''
    });
    const [updating, setUpdating] = useState(false);
    const [confirmUpdateOpen, setConfirmUpdateOpen] = useState(false);
    const [alertDialog, setAlertDialog] = useState({
        open: false,
        title: '',
        description: ''
    });
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
    const [extractingPassport, setExtractingPassport] = useState(false);
    const fileInputRef = useRef(null);

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
            status: employee.status || 'Probation'
        });
        setShowEditModal(true);
    };

    const handleEditChange = (field, value) => {
        setEditForm(prev => ({ ...prev, [field]: value }));
    };

    const handlePassportChange = (field, value) => {
        setPassportForm(prev => ({ ...prev, [field]: value }));
    };

    // Extract text from PDF
    const extractTextFromPDF = async (file) => {
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
    };

    // Parse passport details from extracted text
    const parsePassportDetails = (text) => {
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
    };

    // Format date from text to YYYY-MM-DD format
    const formatDateFromText = (dateStr) => {
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
    };

    // Extract passport details using Mindee API
    const extractPassportWithMindee = async (file) => {
        // Get API key from environment at runtime
        const apiKey = process.env.NEXT_PUBLIC_MINDEE_API_KEY || '';

        console.log('🔵 Checking Mindee API key...');
        console.log('🔵 API Key exists:', !!apiKey);
        console.log('🔵 API Key length:', apiKey?.length || 0);
        console.log('🔵 API Key preview:', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET');

        if (!apiKey || apiKey.trim() === '') {
            throw new Error('Mindee API key not configured. Please set NEXT_PUBLIC_MINDEE_API_KEY in your .env.local file and restart the server.');
        }

        console.log('🔵 Creating FormData...');
        const formData = new FormData();
        formData.append('document', file);
        console.log('🔵 File name:', file.name);
        console.log('🔵 File size:', file.size);
        console.log('🔵 File type:', file.type);

        console.log('🔵 Sending request to Mindee API...');
        console.log('🔵 URL:', MINDEE_PASSPORT_URL);
        console.log('🔵 Using API key:', apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET');
        console.log('🔵 API key full length:', apiKey.length);
        console.log('🔵 API key starts with:', apiKey.substring(0, 3));

        // Mindee API expects Authorization header with "Token" prefix
        // Trim API key to remove any whitespace
        const trimmedApiKey = apiKey.trim();

        console.log('🔵 Final API key check:');
        console.log('🔵 - Length:', trimmedApiKey.length);
        console.log('🔵 - Starts with:', trimmedApiKey.substring(0, 3));
        console.log('🔵 - Format check:', trimmedApiKey.startsWith('md_') ? '✅ Correct format' : '⚠️ Unexpected format');

        const response = await fetch(MINDEE_PASSPORT_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Token ${trimmedApiKey}`
            },
            body: formData
        });

        console.log('🔵 Response status:', response.status);
        console.log('🔵 Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Mindee API Error Response:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                errorData = { message: errorText || 'Unknown error' };
            }

            // Provide helpful error messages for 401
            if (response.status === 401) {
                const errorMsg = errorData?.api_request?.error?.message || errorData?.message || 'Unauthorized';
                const errorDetails = errorData?.api_request?.error?.details || errorData?.details || '';
                throw new Error(`Mindee API Authentication Failed (401): ${errorMsg}\n${errorDetails}\n\nTroubleshooting:\n1. Verify your API key is correct: ${trimmedApiKey.substring(0, 15)}...\n2. Ensure the API key is enabled for "Passport OCR" product in Mindee dashboard\n3. Restart your Next.js dev server after adding/changing .env.local\n4. Check: https://platform.mindee.com/ to verify your API key status`);
            }

            throw new Error(errorData?.api_request?.error?.message || errorData?.message || errorData?.detail || `API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        console.log('🔵 Mindee API Full Response:', JSON.stringify(data, null, 2));

        // Parse Mindee response - check different possible structures
        const document = data?.document || data?.api_request?.result?.document;
        if (!document) {
            console.error('❌ No document in response. Full response structure:', Object.keys(data));
            throw new Error('No document data in response');
        }

        console.log('🔵 Document structure:', Object.keys(document));
        console.log('🔵 Document data:', document);

        // Try different field name variations
        const extractedData = {
            number: document?.passport_number?.value ||
                document?.passportNumber?.value ||
                document?.passport_number ||
                document?.passportNumber ||
                '',
            nationality: document?.nationality?.value ||
                document?.nationality ||
                '',
            issueDate: document?.issuance_date?.value ||
                document?.issuanceDate?.value ||
                document?.date_of_issue?.value ||
                document?.dateOfIssue?.value ||
                document?.issuance_date ||
                document?.issuanceDate ||
                '',
            countryOfIssue: document?.issuance_place?.value ||
                document?.issuancePlace?.value ||
                document?.place_of_issue?.value ||
                document?.placeOfIssue?.value ||
                document?.issuance_place ||
                document?.issuancePlace ||
                '',
            expiryDate: document?.expiry_date?.value ||
                document?.expiryDate?.value ||
                document?.date_of_expiry?.value ||
                document?.dateOfExpiry?.value ||
                document?.expiry_date ||
                document?.expiryDate ||
                ''
        };

        console.log('🔵 Raw extracted data:', extractedData);

        // Format dates to YYYY-MM-DD if needed
        if (extractedData.issueDate && !extractedData.issueDate.includes('-')) {
            extractedData.issueDate = formatDateFromText(extractedData.issueDate);
        }
        if (extractedData.expiryDate && !extractedData.expiryDate.includes('-')) {
            extractedData.expiryDate = formatDateFromText(extractedData.expiryDate);
        }

        console.log('✅ Final extracted data from Mindee:', extractedData);
        return extractedData;
    };

    const handlePassportFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setPassportForm(prev => ({ ...prev, file }));

            // If PDF, extract details automatically
            if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
                try {
                    setExtractingPassport(true);

                    // Try Mindee API first if configured
                    let extractedDetails = null;
                    // Get API key from environment at runtime
                    const apiKey = process.env.NEXT_PUBLIC_MINDEE_API_KEY || '';

                    console.log('🔵 ========================================');
                    console.log('🔵 MINDEE API CONFIGURATION CHECK');
                    console.log('🔵 ========================================');
                    console.log('🔵 API Key exists:', !!apiKey);
                    console.log('🔵 API Key length:', apiKey?.length || 0);
                    console.log('🔵 API Key preview:', apiKey ? apiKey.substring(0, 15) + '...' : 'NOT SET');
                    console.log('🔵 API Key starts with:', apiKey ? apiKey.substring(0, 3) : 'N/A');
                    console.log('🔵 ========================================');

                    if (apiKey && apiKey.trim() !== '' && apiKey.length > 10) {
                        try {
                            console.log('🔵 ✅ Attempting Mindee API extraction...');
                            extractedDetails = await extractPassportWithMindee(file);

                            console.log('🔵 ✅ Mindee extraction successful!');
                            console.log('🔵 ✅ Extracted details:', extractedDetails);

                            // Update form with Mindee extracted data
                            const updatedForm = {
                                number: extractedDetails.number || '',
                                nationality: extractedDetails.nationality || '',
                                issueDate: extractedDetails.issueDate || '',
                                expiryDate: extractedDetails.expiryDate || '',
                                countryOfIssue: extractedDetails.countryOfIssue || extractedDetails.placeOfIssue || '',
                                file: passportForm.file
                            };

                            console.log('🔵 ✅ Updating form with:', updatedForm);
                            setPassportForm(updatedForm);

                            setAlertDialog({
                                open: true,
                                title: "Details Extracted",
                                description: "Passport details have been automatically extracted using Mindee API. Please verify and update if needed."
                            });
                            return;
                        } catch (mindeeError) {
                            console.error('❌ Mindee extraction failed:', mindeeError);
                            console.error('❌ Error details:', mindeeError.message);
                            console.error('❌ Full error:', mindeeError);
                            console.warn('⚠️ Falling back to text extraction...');
                            // Fall through to text extraction
                        }
                    } else {
                        console.log('⚠️ Mindee API key not configured, using text extraction');
                    }

                    // Fallback to text extraction
                    console.log('📄 Using text extraction fallback...');
                    const pdfText = await extractTextFromPDF(file);

                    // Log extracted text
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

                    // Parse text and extract details
                    extractedDetails = parsePassportDetails(pdfText);

                    // Update form with extracted details
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
                        description: "Passport details have been automatically extracted from the PDF. Please verify and update if needed."
                    });
                } catch (error) {
                    console.error('Error extracting passport details:', error);
                    setAlertDialog({
                        open: true,
                        title: "Extraction Failed",
                        description: error.message || "Could not extract details from PDF. Please enter details manually."
                    });
                } finally {
                    setExtractingPassport(false);
                }
            }
        }
    };




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
            // TODO: Add API call to save passport details
            console.log('Passport data:', passportForm);

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));

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

    const handleUpdateEmployee = async () => {
        if (!employee) return;
        try {
            setUpdating(true);
            await axiosInstance.patch(`/Employee/basic-details/${employeeId}`, {
                employeeId: editForm.employeeId,
                contactNumber: editForm.contactNumber,
                email: editForm.email,
                nationality: editForm.nationality,
                country: editForm.nationality,
                status: editForm.status
            });
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

    const fetchEmployee = async () => {
        try {
            setLoading(true);
            setError('');

            const response = await axiosInstance.get(`/Employee/${employeeId}`);
            const data = response.data?.employee || response.data;

            setEmployee(data);
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

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Calculate profile completion percentage
    const calculateProfileCompletion = () => {
        if (!employee) return 0;
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
    const visaDays = employee?.visaExp ? calculateDaysUntilExpiry(employee.visaExp) : null;
    const eidDays = employee?.eidExp ? calculateDaysUntilExpiry(employee.eidExp) : null;
    const medDays = employee?.medExp ? calculateDaysUntilExpiry(employee.medExp) : null;

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
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${employee.status === 'Probation' ? 'bg-[#3B82F6]/15 text-[#1D4ED8]' :
                                                            employee.status === 'Permanent' ? 'bg-[#10B981]/15 text-[#065F46]' :
                                                                employee.status === 'Temporary' ? 'bg-[#F59E0B]/15 text-[#92400E]' :
                                                                    employee.status === 'Notice' ? 'bg-[#EF4444]/15 text-[#991B1B]' :
                                                                        'bg-gray-100 text-gray-700'
                                                        }`}>
                                                        {employee.status}
                                                    </span>
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
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <div className="space-y-6">
                                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6">
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
                                                                    { label: 'Nationality', value: employee.nationality || employee.country }
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

                                                        {/* Document Tags */}
                                                        <div className="flex flex-wrap gap-4">
                                                            {['Passport', 'Visa', 'Emirates ID', 'Labour Card', 'Medical Insurance', 'Driving Licence'].map((doc) => (
                                                                <button
                                                                    key={doc}
                                                                    onClick={() => {
                                                                        if (doc === 'Passport') {
                                                                            setShowPassportModal(true);
                                                                        }
                                                                    }}
                                                                    className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                                                >
                                                                    {doc}
                                                                    <span className="text-lg leading-none">+</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Placeholder for future content */}
                                                    <div className="hidden lg:block"></div>
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
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Salary Information</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {employee.monthlySalary && <InfoRow label="Monthly Salary" value={`AED ${employee.monthlySalary}`} />}
                                                {employee.basic && <InfoRow label="Basic Salary" value={`AED ${employee.basic}`} />}
                                                {employee.houseRentAllowance && <InfoRow label="House Rent Allowance" value={`AED ${employee.houseRentAllowance}`} />}
                                                {employee.otherAllowance && <InfoRow label="Other Allowance" value={`AED ${employee.otherAllowance}`} />}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'personal' && (
                                        <div>
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
                                                <Link
                                                    href={`/Employee/${employeeId}/edit`}
                                                    className="text-blue-600 hover:text-blue-700"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                    </svg>
                                                </Link>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {employee.dateOfBirth && <InfoRow label="Date of Birth" value={formatDate(employee.dateOfBirth)} />}
                                                {employee.age && <InfoRow label="Age" value={`${employee.age} Years`} />}
                                                {employee.fathersName && <InfoRow label="Father's Name" value={employee.fathersName} />}
                                                {employee.gender && <InfoRow label="Gender" value={employee.gender.charAt(0).toUpperCase() + employee.gender.slice(1)} />}
                                                {employee.addressLine1 && <InfoRow label="Address Line 1" value={employee.addressLine1} />}
                                                {employee.addressLine2 && <InfoRow label="Address Line 2" value={employee.addressLine2} />}
                                                {employee.city && <InfoRow label="City" value={employee.city} />}
                                                {employee.state && <InfoRow label="State" value={employee.state} />}
                                                {employee.country && <InfoRow label="Country" value={employee.country} />}
                                                {employee.postalCode && <InfoRow label="Postal Code" value={employee.postalCode} />}
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
                                                {passportForm.number && !extractingPassport && passportForm.file && (
                                                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium bg-green-50 px-4 py-2 rounded-lg border border-green-200">
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M20 6L9 17l-5-5"></path>
                                                        </svg>
                                                        Passport details auto-filled from scan
                                                    </div>
                                                )}
                                                {extractingPassport && (
                                                    <p className="text-sm text-blue-600">Extracting details from PDF...</p>
                                                )}
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
        </div>
    );
}

