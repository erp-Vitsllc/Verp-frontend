'use client';

import { useRef } from 'react';

export default function EducationModal({
    isOpen,
    onClose,
    educationForm,
    setEducationForm,
    educationErrors,
    setEducationErrors,
    savingEducation,
    editingEducationId,
    setEditingEducationId,
    onEducationChange,
    onEducationFileChange,
    onSaveEducation,
    setViewingDocument,
    setShowDocumentViewer,
    employee
}) {
    const educationCertificateFileRef = useRef(null);

    if (!isOpen) return null;

    const handleClose = () => {
        if (!savingEducation) {
            onClose();
            setEditingEducationId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative bg-white rounded-[22px] shadow-[0_5px_20px_rgba(0,0,0,0.1)] w-full max-w-[750px] max-h-[75vh] p-6 md:p-8 flex flex-col">
                <div className="flex items-center justify-center relative pb-3 border-b border-gray-200">
                    <h3 className="text-[22px] font-semibold text-gray-800">{editingEducationId ? 'Edit Education' : 'Add Education'}</h3>
                    <button
                        onClick={handleClose}
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
                                    onChange={(e) => onEducationChange('universityOrBoard', e.target.value)}
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
                                    onChange={(e) => onEducationChange('collegeOrInstitute', e.target.value)}
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
                                    onChange={(e) => onEducationChange('course', e.target.value)}
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
                                    onChange={(e) => onEducationChange('fieldOfStudy', e.target.value)}
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
                                    onChange={(e) => onEducationChange('completedYear', e.target.value)}
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
                                        onChange={onEducationFileChange}
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
                                {educationForm.certificateName && (
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
                                                if (educationForm.certificateData) {
                                                    setViewingDocument({
                                                        data: educationForm.certificateData,
                                                        name: educationForm.certificateName,
                                                        mimeType: educationForm.certificateMime || 'application/pdf'
                                                    });
                                                    setShowDocumentViewer(true);
                                                } else if (editingEducationId) {
                                                    // Fetch document from server
                                                    const fetchDocument = async () => {
                                                        try {
                                                            const axiosInstance = (await import('@/utils/axios')).default;
                                                            const response = await axiosInstance.get(`/Employee/${employee.id || employee._id || employee.employeeId}/document`, {
                                                                params: { type: 'education', docId: editingEducationId }
                                                            });

                                                            if (response.data && response.data.data) {
                                                                setViewingDocument({
                                                                    data: response.data.data,
                                                                    name: response.data.name || educationForm.certificateName,
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
                                <p className="text-xs text-gray-500">Upload file in PDF, JPEG, or PNG format only</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-4 px-6 py-4 border-t border-gray-100">
                    <button
                        onClick={handleClose}
                        className="text-red-500 hover:text-red-600 font-semibold text-sm transition-colors"
                        disabled={savingEducation}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSaveEducation}
                        className="px-6 py-2 rounded-lg bg-[#4C6FFF] text-white font-semibold text-sm hover:bg-[#3A54D4] transition-colors disabled:opacity-50"
                        disabled={savingEducation}
                    >
                        {savingEducation ? 'Saving...' : editingEducationId ? 'Update' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
}




