'use client';

import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from '@/hooks/use-toast';
import {
    normalizeMedicalPolicyNumber,
    normalizeMedicalProvider,
    validateMedicalExpiryDate,
    validateMedicalInsuranceFile,
    validateMedicalIssueDate,
    validateMedicalPolicyNumber,
    validateMedicalProvider,
} from '@/utils/employeeMedicalInsuranceValidation';

export default function MedicalInsuranceModal({
    isOpen,
    onClose,
    medicalInsuranceForm,
    setMedicalInsuranceForm,
    medicalInsuranceErrors,
    setMedicalInsuranceErrors,
    savingMedicalInsurance,
    medicalInsuranceFileRef,
    employee,
    onMedicalInsuranceFileChange,
    onSaveMedicalInsurance,
    setViewingDocument,
    setShowDocumentViewer,
    isRenew = false,
    oldDocumentMeta = null,
}) {
    const { toast } = useToast();
    if (!isOpen) return null;

    const validateField = (field, value) => {
        const errors = { ...medicalInsuranceErrors };
        let result;
        if (field === 'provider') result = validateMedicalProvider(value);
        else if (field === 'number') result = validateMedicalPolicyNumber(value);
        else if (field === 'issueDate') result = validateMedicalIssueDate(value);
        else if (field === 'expiryDate') result = validateMedicalExpiryDate(value, medicalInsuranceForm.issueDate);
        else return;

        if (!result.isValid) errors[field] = result.error;
        else delete errors[field];
        setMedicalInsuranceErrors(errors);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) {
            setMedicalInsuranceForm(prev => ({ ...prev, file: null }));
            setMedicalInsuranceErrors(prev => {
                const next = { ...prev };
                delete next.file;
                return next;
            });
            return;
        }
        const check = validateMedicalInsuranceFile({ file, requireFile: true });
        if (!check.isValid) {
            setMedicalInsuranceErrors(prev => ({ ...prev, file: check.error }));
            e.target.value = '';
            return;
        }
        setMedicalInsuranceErrors(prev => {
            const next = { ...prev };
            delete next.file;
            return next;
        });
        setMedicalInsuranceForm(prev => ({ ...prev, file }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">
                        {isRenew ? 'Renew Medical Insurance' : 'Medical Insurance'}
                    </h3>
                    <button
                        onClick={onClose}
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
                    {isRenew && oldDocumentMeta && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            <p className="font-semibold">Previous Medical Insurance (OLD)</p>
                            {oldDocumentMeta.provider && (
                                <p className="mt-1">Provider: {oldDocumentMeta.provider}</p>
                            )}
                            {oldDocumentMeta.number && (
                                <p>Policy number: {oldDocumentMeta.number}</p>
                            )}
                            {oldDocumentMeta.issueDate && (
                                <p>Issue date: {oldDocumentMeta.issueDate}</p>
                            )}
                            {oldDocumentMeta.expiryDate && (
                                <p>Expiry date: {oldDocumentMeta.expiryDate}</p>
                            )}
                            {oldDocumentMeta.fileName && (
                                <p>Document: {oldDocumentMeta.fileName}</p>
                            )}
                            <p className="mt-1 text-xs text-amber-800">
                                Upload a new document below. The previous file will be archived when renewal is saved.
                            </p>
                        </div>
                    )}
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
                                        const sanitized = normalizeMedicalProvider(e.target.value);
                                        setMedicalInsuranceForm(prev => ({ ...prev, provider: sanitized }));
                                        validateField('provider', sanitized);
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
                                        const sanitized = normalizeMedicalPolicyNumber(e.target.value);
                                        setMedicalInsuranceForm(prev => ({ ...prev, number: sanitized }));
                                        validateField('number', sanitized);
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
                                <DatePicker
                                    value={medicalInsuranceForm.issueDate}
                                    onChange={(val) => {
                                        setMedicalInsuranceForm(prev => ({ ...prev, issueDate: val }));
                                        validateField('issueDate', val);
                                        if (medicalInsuranceForm.expiryDate) {
                                            validateField('expiryDate', medicalInsuranceForm.expiryDate);
                                        }
                                    }}
                                    className={`w-full ${medicalInsuranceErrors.issueDate ? 'border-red-400' : 'border-[#E5E7EB]'}`}
                                    disabled={savingMedicalInsurance}
                                    disabledDays={{ after: new Date() }}
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
                                <DatePicker
                                    value={medicalInsuranceForm.expiryDate}
                                    onChange={(val) => {
                                        setMedicalInsuranceForm(prev => ({ ...prev, expiryDate: val }));
                                        validateField('expiryDate', val);
                                    }}
                                    className={`w-full ${medicalInsuranceErrors.expiryDate ? 'border-red-400' : 'border-[#E5E7EB]'}`}
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
                                    accept=".pdf,application/pdf"
                                    onChange={handleFileChange}
                                    className={`w-full h-10 px-3 rounded-xl border ${medicalInsuranceErrors.file ? 'border-red-400 ring-2 ring-red-400' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2`}
                                    disabled={savingMedicalInsurance}
                                />
                                {medicalInsuranceErrors.file && (
                                    <p className="text-xs text-red-500">{medicalInsuranceErrors.file}</p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Upload file in PDF format only (Max 5MB)</p>
                                {medicalInsuranceForm.file && (
                                    <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                        <span>{medicalInsuranceForm.file.name}</span>
                                    </div>
                                )}
                                {employee?.medicalInsuranceDetails?.document && !medicalInsuranceForm.file && !isRenew && (
                                    <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                        <span>Current file: {employee.medicalInsuranceDetails.document.name || 'medical-insurance.pdf'}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const doc = employee.medicalInsuranceDetails.document;
                                                if (doc.data) {
                                                    setViewingDocument({
                                                        data: doc.data,
                                                        name: doc.name || 'Medical Insurance.pdf',
                                                        mimeType: doc.mimeType || 'application/pdf'
                                                    });
                                                    setShowDocumentViewer(true);
                                                } else {
                                                    const fetchDocument = async () => {
                                                        try {
                                                            const axiosInstance = (await import('@/utils/axios')).default;
                                                            const response = await axiosInstance.get(`/Employee/${employee.id || employee._id || employee.employeeId}/document`, {
                                                                params: { type: 'medicalInsurance' }
                                                            });
                                                            if (response.data?.data) {
                                                                setViewingDocument({
                                                                    data: response.data.data,
                                                                    name: response.data.name || 'Medical Insurance.pdf',
                                                                    mimeType: response.data.mimeType || 'application/pdf'
                                                                });
                                                                setShowDocumentViewer(true);
                                                            } else {
                                                                toast({ variant: 'destructive', title: 'Failed to load document', description: 'Document data was not returned from the server.' });
                                                            }
                                                        } catch (err) {
                                                            console.error('Error fetching document:', err);
                                                            toast({ variant: 'destructive', title: 'Error fetching document', description: 'Please try again.' });
                                                        }
                                                    };
                                                    fetchDocument();
                                                }
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
                        type="button"
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                        disabled={savingMedicalInsurance}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onSaveMedicalInsurance}
                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                        disabled={savingMedicalInsurance}
                    >
                        {savingMedicalInsurance ? 'Saving...' : (isRenew ? 'Renew' : 'Update')}
                    </button>
                </div>
            </div>
        </div>
    );
}
