'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import axiosInstance from '@/utils/axios';
import { validateDate } from "@/utils/validation";
import { getCountryName, getAllCountriesOptions, getAllCountryNames } from '../../utils/helpers';
import { toast } from '@/hooks/use-toast';
// Import cards directly to test if DynamicCards re-exports are causing issues
import BasicDetailsCard from '../cards/BasicDetailsCard';
import PassportCard from '../cards/PassportCard';
import VisaCard from '../cards/VisaCard';
import EmiratesIdCard from '../cards/EmiratesIdCard';
import LabourCard from '../cards/LabourCard';
import MedicalInsuranceCard from '../cards/MedicalInsuranceCard';
import DrivingLicenseCard from '../cards/DrivingLicenseCard';

export default function BasicTab({
    employee,
    employeeId,
    fetchEmployee,
    updateEmployeeOptimistically,
    activeSubTab,
    setActiveSubTab,
    isAdmin,
    hasPermission,
    getCountryName: getCountryNameProp,
    formatDate,
    isUAENationality,
    isVisaRequirementApplicable,
    onEditBasic,
    onViewDocument,
    setViewingDocument,
    setShowDocumentViewer,
    // Education & Experience props
    educationDetails,
    experienceDetails,
    onOpenEducationModal,
    onOpenExperienceModal,
    onEditEducation,
    onEditExperience,
    onDeleteEducation,
    onDeleteExperience,
    deletingEducationId,
    deletingExperienceId
}) {
    const [showVisaTypeDropdownInModal, setShowVisaTypeDropdownInModal] = useState(false);
    const passportCardRef = useRef(null);
    const emiratesIdCardRef = useRef(null);
    const visaCardRef = useRef(null);
    const medicalInsuranceCardRef = useRef(null);
    const labourCardRef = useRef(null);
    const drivingLicenseCardRef = useRef(null);


    // Get all countries for dropdown options - memoize to avoid recalculating on every render
    const allCountriesOptions = useMemo(() => getAllCountriesOptions(), []);
    const allCountryNamesList = useMemo(() => getAllCountryNames(), []);

    return (
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
                        {/* Basic Details Card */}
                        <BasicDetailsCard
                            employee={employee}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            getCountryName={getCountryName}
                            formatDate={formatDate}
                            onEdit={onEditBasic}
                        />

                        {/* Passport Card - Always render to manage modal, but only show card UI when passport exists */}
                        <PassportCard
                            ref={passportCardRef}
                            employee={employee}
                            employeeId={employeeId}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            getCountryName={getCountryNameProp}
                            formatDate={formatDate}
                            fetchEmployee={fetchEmployee}
                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                            onViewDocument={onViewDocument}
                            setViewingDocument={setViewingDocument}
                            setShowDocumentViewer={setShowDocumentViewer}
                        />

                        {/* Visa Card - Always render to manage modal */}
                        {isVisaRequirementApplicable && (
                            <VisaCard
                                ref={visaCardRef}
                                employee={employee}
                                employeeId={employeeId}
                                isAdmin={isAdmin}
                                hasPermission={hasPermission}
                                formatDate={formatDate}
                                isUAENationality={isUAENationality}
                                fetchEmployee={fetchEmployee}
                                updateEmployeeOptimistically={updateEmployeeOptimistically}
                                onViewDocument={onViewDocument}
                                setViewingDocument={setViewingDocument}
                                setShowDocumentViewer={setShowDocumentViewer}
                            />
                        )}

                        {/* Emirates ID Card - Always render to manage modal */}
                        <EmiratesIdCard
                            ref={emiratesIdCardRef}
                            employee={employee}
                            employeeId={employeeId}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            formatDate={formatDate}
                            fetchEmployee={fetchEmployee}
                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                            onViewDocument={onViewDocument}
                            setViewingDocument={setViewingDocument}
                            setShowDocumentViewer={setShowDocumentViewer}
                        />

                        {/* Labour Card - Always render to manage modal */}
                        <LabourCard
                            ref={labourCardRef}
                            employee={employee}
                            employeeId={employeeId}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            formatDate={formatDate}
                            fetchEmployee={fetchEmployee}
                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                            onViewDocument={onViewDocument}
                            setViewingDocument={setViewingDocument}
                            setShowDocumentViewer={setShowDocumentViewer}
                        />

                        {/* Medical Insurance Card - Always render to manage modal */}
                        <MedicalInsuranceCard
                            ref={medicalInsuranceCardRef}
                            employee={employee}
                            employeeId={employeeId}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            formatDate={formatDate}
                            fetchEmployee={fetchEmployee}
                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                            onViewDocument={onViewDocument}
                            setViewingDocument={setViewingDocument}
                            setShowDocumentViewer={setShowDocumentViewer}
                        />

                        {/* Driving License Card - Always render to manage modal */}
                        <DrivingLicenseCard
                            ref={drivingLicenseCardRef}
                            employee={employee}
                            employeeId={employeeId}
                            isAdmin={isAdmin}
                            hasPermission={hasPermission}
                            formatDate={formatDate}
                            fetchEmployee={fetchEmployee}
                            updateEmployeeOptimistically={updateEmployeeOptimistically}
                            onViewDocument={onViewDocument}
                            setViewingDocument={setViewingDocument}
                            setShowDocumentViewer={setShowDocumentViewer}
                        />
                    </div>

                    {/* Document Buttons */}
                    {(() => {
                        const hasVisitVisa = employee.visaDetails?.visit?.number;
                        const hasEmploymentVisa = employee.visaDetails?.employment?.number;
                        const hasSpouseVisa = employee.visaDetails?.spouse?.number;
                        const hasAnyVisa = hasVisitVisa || hasEmploymentVisa || hasSpouseVisa;
                        const documentButtons = [];

                        if (!employee.passportDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_passport', 'isView'))) {
                            documentButtons.push(
                                <button
                                    key="passport"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (passportCardRef.current) {
                                            passportCardRef.current.openModal();
                                        }
                                    }}
                                    style={{ width: '117px' }}
                                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                >
                                    Passport
                                    <span className="text-sm leading-none font-bold">+</span>
                                </button>
                            );
                        }

                        if (isVisaRequirementApplicable && !hasAnyVisa && (isAdmin() || hasPermission('hrm_employees_view_visa', 'isView'))) {
                            documentButtons.push(
                                <div key="visa" className="relative" style={{ width: '92px' }}>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setShowVisaTypeDropdownInModal(!showVisaTypeDropdownInModal);
                                        }}
                                        className="w-full px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                    >
                                        Visa
                                        <span className="text-sm leading-none font-bold">+</span>
                                    </button>
                                    {showVisaTypeDropdownInModal && (
                                        <div className="absolute top-full left-0 mt-2 w-full z-[60] bg-white rounded-lg border border-gray-200 shadow-lg">
                                            {[
                                                { key: 'visit', label: 'Visit Visa' },
                                                { key: 'employment', label: 'Employment Visa' },
                                                { key: 'spouse', label: 'Spouse Visa' }
                                            ].map((type) => (
                                                <button
                                                    key={type.key}
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setShowVisaTypeDropdownInModal(false);
                                                        if (visaCardRef.current) {
                                                            visaCardRef.current.openModal(type.key);
                                                        }
                                                    }}
                                                    className="w-full px-4 py-2 text-left text-xs text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                                                >
                                                    {type.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        if (!employee.emiratesIdDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_emirates_id', 'isView'))) {
                            documentButtons.push(
                                <button
                                    key="emirates-id"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (emiratesIdCardRef.current) {
                                            emiratesIdCardRef.current.openModal();
                                        }
                                    }}
                                    style={{ width: '138px' }}
                                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                >
                                    Emirates ID
                                    <span className="text-sm leading-none font-bold">+</span>
                                </button>
                            );
                        }

                        if (!employee.labourCardDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_labour_card', 'isView'))) {
                            documentButtons.push(
                                <button
                                    key="labour-card"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (labourCardRef.current) {
                                            labourCardRef.current.openModal();
                                        }
                                    }}
                                    style={{ width: '145px' }}
                                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                >
                                    Labour Card
                                    <span className="text-sm leading-none font-bold">+</span>
                                </button>
                            );
                        }

                        if (!employee.medicalInsuranceDetails?.provider && (isAdmin() || hasPermission('hrm_employees_view_medical_insurance', 'isView'))) {
                            documentButtons.push(
                                <button
                                    key="medical-insurance"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (medicalInsuranceCardRef.current) {
                                            medicalInsuranceCardRef.current.openModal();
                                        }
                                    }}
                                    style={{ width: '190px' }}
                                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                >
                                    Medical Insurance
                                    <span className="text-sm leading-none font-bold">+</span>
                                </button>
                            );
                        }

                        if (!employee.drivingLicenceDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_driving_license', 'isView'))) {
                            documentButtons.push(
                                <button
                                    key="driving-license"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (drivingLicenseCardRef.current) {
                                            drivingLicenseCardRef.current.openModal();
                                        }
                                    }}
                                    style={{ width: '190px' }}
                                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                                >
                                    Driving License
                                    <span className="text-sm leading-none font-bold">+</span>
                                </button>
                            );
                        }

                        if (documentButtons.length === 0) {
                            return null;
                        }

                        return (
                            <div className="mt-6">
                                <div className="flex flex-wrap gap-2" style={{ width: '550px' }}>
                                    {documentButtons}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {activeSubTab === 'education' && (
                <div className="space-y-6">
                    {(isAdmin() || hasPermission('hrm_employees_view_education', 'isView')) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-800">Education Details</h3>
                                {(isAdmin() || hasPermission('hrm_employees_view_education', 'isCreate')) && (
                                    <button
                                        onClick={onOpenEducationModal}
                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        Add Education
                                        <span className="text-lg leading-none">+</span>
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
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
                                                                        onViewDocument({
                                                                            data: education.certificate.data || '',
                                                                            name: education.certificate.name || '',
                                                                            mimeType: education.certificate.mimeType || '',
                                                                            moduleId: 'hrm_employees_view_education'
                                                                        });
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
                                                                    onClick={() => onEditEducation(education)}
                                                                    className="text-blue-600 hover:text-blue-700"
                                                                    disabled={deletingEducationId === educationId}
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => onDeleteEducation(educationId)}
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
                    {(isAdmin() || hasPermission('hrm_employees_view_experience', 'isView')) && (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-semibold text-gray-800">Experience Details</h3>
                                {(isAdmin() || hasPermission('hrm_employees_view_experience', 'isCreate')) && (
                                    <button
                                        onClick={onOpenExperienceModal}
                                        className="px-5 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                                    >
                                        Add Experience
                                        <span className="text-lg leading-none">+</span>
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full min-w-0 table-auto">
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
                                                            {experience.startDate ? formatDate(experience.startDate) : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {experience.endDate ? formatDate(experience.endDate) : '—'}
                                                        </td>
                                                        <td className="py-3 px-4 text-sm text-gray-500">
                                                            {experience.certificate?.name ? (
                                                                <button
                                                                    onClick={() => {
                                                                        onViewDocument({
                                                                            data: experience.certificate.data || '',
                                                                            name: experience.certificate.name || '',
                                                                            mimeType: experience.certificate.mimeType || '',
                                                                            moduleId: 'hrm_employees_view_experience'
                                                                        });
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
                                                                    onClick={() => onEditExperience(experience)}
                                                                    className="text-blue-600 hover:text-blue-700"
                                                                    disabled={deletingExperienceId === experienceId}
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => onDeleteExperience(experienceId)}
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
    );
}


