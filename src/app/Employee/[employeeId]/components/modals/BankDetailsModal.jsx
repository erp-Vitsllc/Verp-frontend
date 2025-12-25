'use client';

import { useRef } from 'react';

export default function BankDetailsModal({
    isOpen,
    onClose,
    bankForm,
    setBankForm,
    bankFormErrors,
    setBankFormErrors,
    savingBank,
    uploadingDocument,
    onBankChange,
    onBankFileChange,
    onSaveBank,
    employee,
    setViewingDocument,
    setShowDocumentViewer
}) {
    const bankFileRef = useRef(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Salary Bank Account</h3>
                    <button
                        onClick={onClose}
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
                                        onChange={(e) => onBankChange(input.field, e.target.value)}
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
                        {(() => {
                            // Check if form has existing bank attachment data (like passport pattern)
                            const hasFormBankAttachment = !!(bankForm.file || bankForm.fileBase64 || bankForm.fileName);
                            
                            return (
                                <div className="flex flex-row md:flex-row items-start gap-3 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                                    <label className="text-[14px] font-medium text-[#555555] w-full md:w-1/3 pt-2">
                                        Attachment {!hasFormBankAttachment && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="w-full md:flex-1 flex flex-col gap-2">
                                        <input
                                            ref={bankFileRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            onChange={onBankFileChange}
                                            className={`w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:text-[#3B82F6] file:font-medium file:px-4 file:py-2 ${bankFormErrors.file ? 'ring-2 ring-red-400 border-red-400' : ''}`}
                                            disabled={savingBank}
                                        />
                                        {bankFormErrors.file && (
                                            <p className="text-xs text-red-500">{bankFormErrors.file}</p>
                                        )}
                                        {hasFormBankAttachment && (
                                            <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                                <div className="flex items-center gap-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 6L9 17l-5-5"></path>
                                                    </svg>
                                                    <span>
                                                        {bankForm.file ? bankForm.file.name : bankForm.fileName || 'bank-attachment.pdf'}
                                                    </span>
                                                </div>
                                                {((bankForm.fileBase64 || bankForm.file) && setViewingDocument) && (
                                                    <button
                                            onClick={() => {
                                                if (bankForm.fileBase64) {
                                                    // Check if it's a Cloudinary URL or base64 data
                                                    if (bankForm.fileBase64.startsWith('http')) {
                                                        // Cloudinary URL - fetch from server
                                                        const fetchDocument = async () => {
                                                            try {
                                                                const axiosInstance = (await import('@/utils/axios')).default;
                                                                const response = await axiosInstance.get(`/Employee/${employee.id || employee._id || employee.employeeId}/document`, {
                                                                    params: { type: 'bankAttachment' }
                                                                });

                                                                if (response.data && response.data.data) {
                                                                    setViewingDocument({
                                                                        data: response.data.data,
                                                                        name: response.data.name || bankForm.fileName || 'Bank Attachment.pdf',
                                                                        mimeType: response.data.mimeType || bankForm.fileMime || 'application/pdf'
                                                                    });
                                                                    setShowDocumentViewer(true);
                                                                } else {
                                                                    alert('Failed to load document data');
                                                                }
                                                            } catch (err) {
                                                                console.error('Error fetching document:', err);
                                                                alert('Error fetching document. Please try again.');
                                                            }
                                                        };
                                                        fetchDocument();
                                                    } else {
                                                        // Base64 data - use directly
                                                        setViewingDocument({
                                                            data: bankForm.fileBase64,
                                                            name: bankForm.fileName || 'Bank Attachment.pdf',
                                                            mimeType: bankForm.fileMime || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    }
                                                } else if (bankForm.file) {
                                                    // New file selected - read it
                                                    const reader = new FileReader();
                                                    reader.onload = (e) => {
                                                        const base64 = e.target.result.split(',')[1];
                                                        setViewingDocument({
                                                            data: base64,
                                                            name: bankForm.file.name,
                                                            mimeType: bankForm.file.type || 'application/pdf'
                                                        });
                                                        setShowDocumentViewer(true);
                                                    };
                                                    reader.readAsDataURL(bankForm.file);
                                                }
                                            }}
                                            className="text-blue-600 hover:text-blue-700 text-xs font-medium underline"
                                        >
                                            View
                                        </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm"
                        disabled={savingBank}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveBank}
                        disabled={savingBank || uploadingDocument}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {uploadingDocument ? (
                            <>
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Uploading document...</span>
                            </>
                        ) : savingBank ? (
                            <>
                                <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>Save</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}


