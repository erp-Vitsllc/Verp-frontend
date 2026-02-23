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
    isCompanyProfile
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
                        isCompanyProfile={isCompanyProfile}
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

                    {/* Sections hidden for Company Profile */}
                    {!isCompanyProfile && (
                        <>
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
                        </>
                    )}
                </div>

                {/* Document Buttons */}
                {(() => {
                    // Hide document buttons for company profile
                    if (isCompanyProfile) return null;

                    const isPermanent = employee?.status?.trim() === 'Permanent';
                    const hasVisitVisa = employee.visaDetails?.visit?.number;
                    // If permanent, ignore visit visa for 'hasAnyVisa' check (to show Add Button instead of Card)
                    const hasVisibleVisitVisa = !isPermanent && hasVisitVisa;

                    const hasEmploymentVisa = employee.visaDetails?.employment?.number;
                    const hasSpouseVisa = employee.visaDetails?.spouse?.number;
                    const hasAnyVisa = hasVisibleVisitVisa || hasEmploymentVisa || hasSpouseVisa;
                    const documentButtons = [];
                    const isResident = !isVisaRequirementApplicable || hasEmploymentVisa || hasSpouseVisa;

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
                                        ].filter(type => {
                                            const isPermanent = employee?.status?.trim() === 'Permanent';
                                            if (isPermanent && type.key === 'visit') return false;
                                            return true;
                                        }).map((type) => (
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

                    if (isResident && !employee.emiratesIdDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_emirates_id', 'isView'))) {
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

                    if (isResident && !employee.labourCardDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_labour_card', 'isView'))) {
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

                    if ((isResident || hasVisibleVisitVisa) && !employee.medicalInsuranceDetails?.provider && (isAdmin() || hasPermission('hrm_employees_view_medical_insurance', 'isView'))) {
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

                    if ((isResident || hasVisibleVisitVisa) && !employee.drivingLicenceDetails?.number && (isAdmin() || hasPermission('hrm_employees_view_driving_license', 'isView'))) {
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

        </div>
    );
}


