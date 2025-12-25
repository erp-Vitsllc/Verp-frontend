'use client';

export default function DrivingLicenseModal({
    isOpen,
    onClose,
    drivingLicenseForm,
    setDrivingLicenseForm,
    drivingLicenseErrors,
    setDrivingLicenseErrors,
    savingDrivingLicense,
    drivingLicenseFileRef,
    employee,
    onDrivingLicenseFileChange,
    onSaveDrivingLicense,
    validateDrivingLicenseDateField,
    setViewingDocument,
    setShowDocumentViewer
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={onClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">Driving License</h3>
                    <button
                        onClick={onClose}
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
                                        validateDrivingLicenseDateField('issueDate', e.target.value);
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
                                        validateDrivingLicenseDateField('expiryDate', e.target.value);
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
                                    onChange={onDrivingLicenseFileChange}
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
                                {employee?.drivingLicenceDetails?.document && !drivingLicenseForm.file && (
                                    <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                                        <span>Current file: {employee.drivingLicenceDetails.document.name || 'driving-license.pdf'}</span>
                                        <button
                                            onClick={() => {
                                                const doc = employee.drivingLicenceDetails.document;
                                                if (doc.data) {
                                                    setViewingDocument({
                                                        data: doc.data,
                                                        name: doc.name || 'Driving License.pdf',
                                                        mimeType: doc.mimeType || 'application/pdf'
                                                    });
                                                    setShowDocumentViewer(true);
                                                } else {
                                                    // Fetch document from server
                                                    const fetchDocument = async () => {
                                                        try {
                                                            const axiosInstance = (await import('@/utils/axios')).default;
                                                            const response = await axiosInstance.get(`/Employee/${employee.id || employee._id || employee.employeeId}/document`, {
                                                                params: { type: 'drivingLicense' }
                                                            });

                                                            if (response.data && response.data.data) {
                                                                setViewingDocument({
                                                                    data: response.data.data,
                                                                    name: response.data.name || 'Driving License.pdf',
                                                                    mimeType: response.data.mimeType || 'application/pdf'
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
                        onClick={onClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                        disabled={savingDrivingLicense}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveDrivingLicense}
                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                        disabled={savingDrivingLicense}
                    >
                        {savingDrivingLicense ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}


