'use client';

import { DatePicker } from "@/components/ui/date-picker";

export default function DocumentModal({
    isOpen,
    onClose,
    documentForm,
    setDocumentForm,
    documentErrors,
    setDocumentErrors,
    savingDocument,
    documentFileRef,
    editingDocumentIndex,
    onDocumentFileChange,
    onSaveDocument,
    modalMode = 'with_expiry'
}) {
    if (!isOpen) return null;

    const isLabour = modalMode === 'labour';
    const hasExpiry = documentForm.hasExpiry !== false;
    const hasValue = !!documentForm.hasValue;

    const handleClose = () => {
        if (!savingDocument) {
            onClose();
            setDocumentErrors({});
        }
    };

    const modalTitle = (() => {
        if (editingDocumentIndex !== null) return 'Edit Document';
        if (isLabour) return 'Labour card salary';
        return 'Add document';
    })();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">{modalTitle}</h3>
                    <button
                        onClick={handleClose}
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
                    {!isLabour && (
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Document Type <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={documentForm.type || ''}
                                onChange={(e) => setDocumentForm(prev => ({ ...prev, type: e.target.value }))}
                                className={`w-full h-10 px-3 rounded-xl border ${documentErrors.type ? 'border-red-500' : 'border-[#E5E7EB]'} bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40`}
                                placeholder="e.g., Passport, Visa, Emirates ID"
                                disabled={savingDocument}
                            />
                            {documentErrors.type && (
                                <p className="text-xs text-red-500">{documentErrors.type}</p>
                            )}
                        </div>
                    )}

                    {!isLabour && (
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Issue Date <span className="text-gray-400 font-normal text-xs ml-1">(Optional)</span>
                            </label>
                            <DatePicker
                                value={documentForm.issueDate || ''}
                                onChange={(date) => setDocumentForm(prev => ({ ...prev, issueDate: date }))}
                                className="bg-[#F7F9FC] border-[#E5E7EB]"
                                disabled={savingDocument}
                            />
                        </div>
                    )}

                    {!isLabour && (
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Has Expiry Date? <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDocumentForm(prev => ({ ...prev, hasExpiry: true }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${hasExpiry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    disabled={savingDocument}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDocumentForm(prev => ({ ...prev, hasExpiry: false, expiryDate: '' }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!hasExpiry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    disabled={savingDocument}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLabour && hasExpiry && (
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Expiry <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                value={documentForm.expiryDate || ''}
                                onChange={(date) => setDocumentForm(prev => ({ ...prev, expiryDate: date }))}
                                className={`bg-[#F7F9FC] ${documentErrors.expiryDate ? 'border-red-500 ring-2 ring-red-400' : 'border-[#E5E7EB]'}`}
                                disabled={savingDocument}
                            />
                            {documentErrors.expiryDate && (
                                <p className="text-xs text-red-500">{documentErrors.expiryDate}</p>
                            )}
                        </div>
                    )}

                    {!isLabour && (
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Add Value? <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setDocumentForm(prev => ({ ...prev, hasValue: true }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${hasValue ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    disabled={savingDocument}
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDocumentForm(prev => ({ ...prev, hasValue: false, value: '' }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${!hasValue ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                                    disabled={savingDocument}
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}

                    {!isLabour && hasValue && (
                        <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2 bg-white">
                            <label className="text-[14px] font-medium text-[#555555]">
                                Value
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={documentForm.value || ''}
                                onChange={(e) => setDocumentForm(prev => ({ ...prev, value: e.target.value }))}
                                className="w-full h-10 px-3 rounded-xl border border-[#E5E7EB] bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40"
                                placeholder="Enter value"
                                disabled={savingDocument}
                            />
                        </div>
                    )}

                    {isLabour && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-gray-100 rounded-xl px-4 py-3 bg-white">
                            <div className="md:col-span-2 text-sm font-semibold text-gray-700">
                                Basic + allowances must equal total salary
                            </div>
                            {[
                                ['basicSalary', 'Basic'],
                                ['houseRentAllowance', 'House Rent Allowance'],
                                ['vehicleAllowance', 'Vehicle Allowance'],
                                ['fuelAllowance', 'Fuel Allowance'],
                                ['otherAllowance', 'Other Allowance'],
                                ['totalSalary', 'Total Salary']
                            ].map(([key, label]) => (
                                <div key={key} className="flex flex-col gap-1">
                                    <label className="text-[13px] font-medium text-[#555555]">
                                        {label} <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={documentForm[key] || ''}
                                        onChange={(e) => setDocumentForm(prev => ({ ...prev, [key]: e.target.value }))}
                                        className={`w-full h-10 px-3 rounded-xl border bg-[#F7F9FC] text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-40 ${documentErrors[key] ? 'border-red-500' : 'border-[#E5E7EB]'}`}
                                        disabled={savingDocument}
                                    />
                                    {documentErrors[key] && (
                                        <p className="text-xs text-red-500">{documentErrors[key]}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-col gap-2 border border-gray-100 rounded-xl px-4 py-2.5 bg-white">
                        <label className="text-[14px] font-medium text-[#555555]">
                            Attachment {editingDocumentIndex === null && <span className="text-red-500">*</span>}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                ref={documentFileRef}
                                type="file"
                                accept=".pdf, .jpg, .jpeg, .png"
                                onChange={onDocumentFileChange}
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
                        <p className="text-xs text-gray-500 mt-1">Upload file in PDF, JPG or PNG format (Max 5MB)</p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={handleClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm"
                        disabled={savingDocument}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveDocument}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        disabled={savingDocument}
                    >
                        {savingDocument ? 'Saving...' : editingDocumentIndex !== null ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}
