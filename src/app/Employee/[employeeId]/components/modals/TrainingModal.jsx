'use client';

export default function TrainingModal({
    isOpen,
    onClose,
    trainingForm,
    setTrainingForm,
    trainingErrors,
    setTrainingErrors,
    savingTraining,
    trainingCertificateFileRef,
    editingTrainingIndex,
    onTrainingFileChange,
    onSaveTraining,
    employee,
    setViewingDocument,
    setShowDocumentViewer
}) {
    if (!isOpen) return null;

    const handleClose = () => {
        if (!savingTraining) {
            onClose();
            setTrainingErrors({});
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={handleClose}></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[80vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">{editingTrainingIndex !== null ? 'Edit Training' : 'Add Training'}</h3>
                    <button
                        onClick={handleClose}
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
                                onChange={onTrainingFileChange}
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
                            {trainingForm.certificateName && (
                                <div className="flex items-center justify-between gap-2 text-blue-600 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 mt-2">
                                    <div className="flex items-center gap-2">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 6L9 17l-5-5"></path>
                                        </svg>
                                        <span>{trainingForm.certificateName}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (trainingForm.certificateBase64) {
                                                setViewingDocument({
                                                    data: trainingForm.certificateBase64,
                                                    name: trainingForm.certificateName,
                                                    mimeType: trainingForm.certificateMime || 'application/pdf'
                                                });
                                                setShowDocumentViewer(true);
                                            } else if (editingTrainingIndex !== null && employee?.trainingDetails?.[editingTrainingIndex]?._id) {
                                                // Fetch document from server
                                                const editingId = employee.trainingDetails[editingTrainingIndex]._id;
                                                const fetchDocument = async () => {
                                                    try {
                                                        const axiosInstance = (await import('@/utils/axios')).default;
                                                        const response = await axiosInstance.get(`/Employee/${employee.id || employee._id || employee.employeeId}/document`, {
                                                            params: { type: 'training', docId: editingId }
                                                        });

                                                        if (response.data && response.data.data) {
                                                            setViewingDocument({
                                                                data: response.data.data,
                                                                name: response.data.name || trainingForm.certificateName,
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
                <div className="flex items-center justify-end gap-4 border-t border-gray-200 px-6 py-4">
                    <button
                        onClick={handleClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm"
                        disabled={savingTraining}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveTraining}
                        className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                        disabled={savingTraining}
                    >
                        {savingTraining ? 'Saving...' : editingTrainingIndex !== null ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}




