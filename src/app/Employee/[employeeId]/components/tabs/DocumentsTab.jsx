'use client';

import { useToast } from '@/hooks/use-toast';

export default function DocumentsTab({
    employee,
    isAdmin,
    hasPermission,
    onOpenDocumentModal,
    onViewDocument,
    onEditDocument,
    onDeleteDocument
}) {
    const { toast } = useToast();
    // Collect all documents and attachments
    const allDocuments = [];

    // Add manually added documents
    if (employee?.documents && employee.documents.length > 0) {
        employee.documents.forEach((doc, idx) => {
            allDocuments.push({
                type: doc.type || 'Document',
                document: doc.document,
                source: 'manual',
                index: idx,
                isEditable: true
            });
        });
    }

    // Add Passport
    if (employee?.passportDetails?.document && (employee.passportDetails.document.url || employee.passportDetails.document.data || employee.passportDetails.document.name)) {
        allDocuments.push({
            type: 'Passport',
            description: `Passport Number: ${employee.passportDetails.number || 'N/A'}`,
            document: employee.passportDetails.document,
            source: 'passport',
            isEditable: false
        });
    }

    // Add Visa documents
    if (employee?.visaDetails) {
        if (employee.visaDetails.visit?.document && (employee.visaDetails.visit.document.url || employee.visaDetails.visit.document.data || employee.visaDetails.visit.document.name)) {
            allDocuments.push({
                type: 'Visit Visa',
                description: `Visa Number: ${employee.visaDetails.visit.number || 'N/A'}`,
                document: employee.visaDetails.visit.document,
                source: 'visa-visit',
                isEditable: false
            });
        }
        if (employee.visaDetails.employment?.document && (employee.visaDetails.employment.document.url || employee.visaDetails.employment.document.data || employee.visaDetails.employment.document.name)) {
            allDocuments.push({
                type: 'Employment Visa',
                description: `Visa Number: ${employee.visaDetails.employment.number || 'N/A'}`,
                document: employee.visaDetails.employment.document,
                source: 'visa-employment',
                isEditable: false
            });
        }
        if (employee.visaDetails.spouse?.document && (employee.visaDetails.spouse.document.url || employee.visaDetails.spouse.document.data || employee.visaDetails.spouse.document.name)) {
            allDocuments.push({
                type: 'Spouse Visa',
                description: `Visa Number: ${employee.visaDetails.spouse.number || 'N/A'}`,
                document: employee.visaDetails.spouse.document,
                source: 'visa-spouse',
                isEditable: false
            });
        }
    }

    // Add Emirates ID
    if (employee?.emiratesIdDetails?.document && (employee.emiratesIdDetails.document.url || employee.emiratesIdDetails.document.data || employee.emiratesIdDetails.document.name)) {
        allDocuments.push({
            type: 'Emirates ID',
            description: `Emirates ID Number: ${employee.emiratesIdDetails.number || 'N/A'}`,
            document: employee.emiratesIdDetails.document,
            source: 'emirates-id',
            isEditable: false
        });
    }

    // Add Labour Card
    if (employee?.labourCardDetails?.document && (employee.labourCardDetails.document.url || employee.labourCardDetails.document.data || employee.labourCardDetails.document.name)) {
        allDocuments.push({
            type: 'Labour Card',
            description: `Labour Card Number: ${employee.labourCardDetails.number || 'N/A'}`,
            document: employee.labourCardDetails.document,
            source: 'labour-card',
            isEditable: false
        });
    }

    // Add Medical Insurance
    if (employee?.medicalInsuranceDetails?.document && (employee.medicalInsuranceDetails.document.url || employee.medicalInsuranceDetails.document.data || employee.medicalInsuranceDetails.document.name)) {
        allDocuments.push({
            type: 'Medical Insurance',
            description: `Provider: ${employee.medicalInsuranceDetails.provider || 'N/A'}, Policy: ${employee.medicalInsuranceDetails.number || 'N/A'}`,
            document: employee.medicalInsuranceDetails.document,
            source: 'medical-insurance',
            isEditable: false
        });
    }

    // Add Driving License
    if (employee?.drivingLicenceDetails?.document && (employee.drivingLicenceDetails.document.url || employee.drivingLicenceDetails.document.data || employee.drivingLicenceDetails.document.name)) {
        allDocuments.push({
            type: 'Driving License',
            description: `License Number: ${employee.drivingLicenceDetails.number || 'N/A'}`,
            document: employee.drivingLicenceDetails.document,
            source: 'driving-license',
            isEditable: false
        });
    }

    // Add Bank Attachment
    if (employee?.bankAttachment && (employee.bankAttachment.url || employee.bankAttachment.data || employee.bankAttachment.name)) {
        allDocuments.push({
            type: 'Bank Account Attachment',
            description: `Bank: ${employee.bankName || employee.bank || 'N/A'}`,
            document: employee.bankAttachment,
            source: 'bank',
            isEditable: false
        });
    }

    // Add only the latest Offer Letter
    let latestOfferLetter = null;
    if (employee?.salaryHistory && Array.isArray(employee.salaryHistory)) {
        const sortedHistory = [...employee.salaryHistory];
        for (const entry of sortedHistory) {
            if (entry.offerLetter && (entry.offerLetter.url || entry.offerLetter.data || entry.offerLetter.name)) {
                latestOfferLetter = {
                    type: 'Offer Letter',
                    description: `Salary History - ${entry.month || 'N/A'} ${entry.year || ''}`,
                    document: entry.offerLetter,
                    source: 'salary-history-latest',
                    isEditable: false
                };
                break;
            }
        }
    }
    if (!latestOfferLetter && employee?.offerLetter && (employee.offerLetter.url || employee.offerLetter.data || employee.offerLetter.name)) {
        latestOfferLetter = {
            type: 'Offer Letter',
            description: 'Current Salary Offer Letter',
            document: employee.offerLetter,
            source: 'salary-offer-letter',
            isEditable: false
        };
    }
    if (latestOfferLetter) {
        allDocuments.push(latestOfferLetter);
    }

    // Add Education Certificates
    if (employee?.educationDetails && Array.isArray(employee.educationDetails)) {
        employee.educationDetails.forEach((edu, idx) => {
            if (edu.certificate && (edu.certificate.url || edu.certificate.data || edu.certificate.name)) {
                allDocuments.push({
                    type: 'Education Certificate',
                    description: `${edu.course || 'Education'} - ${edu.universityOrBoard || 'N/A'}`,
                    document: edu.certificate,
                    source: `education-${idx}`,
                    isEditable: false
                });
            }
        });
    }

    // Add Experience Certificates
    if (employee?.experienceDetails && Array.isArray(employee.experienceDetails)) {
        employee.experienceDetails.forEach((exp, idx) => {
            if (exp.certificate && (exp.certificate.url || exp.certificate.data || exp.certificate.name)) {
                allDocuments.push({
                    type: 'Experience Certificate',
                    description: `${exp.designation || 'Position'} at ${exp.company || 'N/A'}`,
                    document: exp.certificate,
                    source: `experience-${idx}`,
                    isEditable: false
                });
            }
        });
    }

    // Add Training Certificates
    if (employee?.trainingDetails && Array.isArray(employee.trainingDetails)) {
        employee.trainingDetails.forEach((training, idx) => {
            if (training.certificate && (training.certificate.url || training.certificate.data || training.certificate.name)) {
                allDocuments.push({
                    type: 'Training Certificate',
                    description: `${training.trainingName || 'Training'} - ${training.trainingFrom || 'N/A'}`,
                    document: training.certificate,
                    source: `training-${idx}`,
                    isEditable: false
                });
            }
        });
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-800">Documents</h2>
                {(isAdmin() || hasPermission('hrm_employees_view_documents', 'isCreate')) && (
                    <button
                        onClick={onOpenDocumentModal}
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
                        {allDocuments.length > 0 ? (
                            <>
                                {allDocuments.map((docItem, idx) => {
                                    const isEditable = docItem.isEditable;
                                    return (
                                        <tr key={`${docItem.source}-${idx}`} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{docItem.type}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {docItem.document?.name ? (
                                                    <button
                                                        onClick={() => {
                                                            const documentData = docItem.document.url || docItem.document.data;
                                                            if (documentData) {
                                                                // Check if it's a Cloudinary URL or base64 data
                                                                const isCloudinaryUrl = docItem.document.url || (docItem.document.data && (docItem.document.data.startsWith('http://') || docItem.document.data.startsWith('https://')));
                                                                
                                                                // Determine moduleId based on document source
                                                                let moduleId = 'hrm_employees_view_documents'; // Default
                                                                if (docItem.source === 'passport') {
                                                                    moduleId = 'hrm_employees_view_passport';
                                                                } else if (docItem.source?.startsWith('visa-')) {
                                                                    moduleId = 'hrm_employees_view_visa';
                                                                } else if (docItem.source === 'emirates-id') {
                                                                    moduleId = 'hrm_employees_view_emirates_id';
                                                                } else if (docItem.source === 'labour-card') {
                                                                    moduleId = 'hrm_employees_view_labour_card';
                                                                } else if (docItem.source === 'medical-insurance') {
                                                                    moduleId = 'hrm_employees_view_medical_insurance';
                                                                } else if (docItem.source === 'driving-license') {
                                                                    moduleId = 'hrm_employees_view_driving_license';
                                                                } else if (docItem.source === 'education') {
                                                                    moduleId = 'hrm_employees_view_education';
                                                                } else if (docItem.source === 'experience') {
                                                                    moduleId = 'hrm_employees_view_experience';
                                                                } else if (docItem.source === 'training') {
                                                                    moduleId = 'hrm_employees_view_training';
                                                                } else if (docItem.source === 'salary-history-latest' || docItem.source === 'salary-history') {
                                                                    moduleId = 'hrm_employees_view_salary_history';
                                                                } else if (docItem.source === 'offer-letter') {
                                                                    moduleId = 'hrm_employees_view_salary';
                                                                }
                                                                
                                                                if (isCloudinaryUrl) {
                                                                    // Cloudinary URL - use directly
                                                                    onViewDocument({
                                                                        data: documentData,
                                                                        name: docItem.document.name,
                                                                        mimeType: docItem.document.mimeType || 'application/pdf',
                                                                        moduleId: moduleId
                                                                    });
                                                                } else {
                                                                    // Base64 data - clean and use
                                                                    let cleanData = documentData;
                                                                    if (cleanData.includes(',')) {
                                                                        cleanData = cleanData.split(',')[1];
                                                                    }
                                                                    onViewDocument({
                                                                        data: cleanData,
                                                                        name: docItem.document.name,
                                                                        mimeType: docItem.document.mimeType || 'application/pdf',
                                                                        moduleId: moduleId
                                                                    });
                                                                }
                                                            } else {
                                                                // If no local data but name exists, show error
                                                                toast({
                                                                    title: "Document data not available",
                                                                    description: "Please refresh the page."
                                                                });
                                                            }
                                                        }}
                                                        className="text-blue-600 hover:text-blue-700 underline text-sm"
                                                    >
                                                        {docItem.document.name}
                                                    </button>
                                                ) : (
                                                    <span className="text-sm text-gray-400">—</span>
                                                )}
                                            </td>
                                            {isEditable && (isAdmin() || hasPermission('hrm_employees_view_documents', 'isEdit')) && (
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => onEditDocument(docItem.index)}
                                                            className="text-blue-600 hover:text-blue-700"
                                                            title="Edit"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteDocument(docItem.index)}
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
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
