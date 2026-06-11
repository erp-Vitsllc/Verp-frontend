'use client';

import { useState, useMemo, useRef, useCallback, useLayoutEffect, useEffect } from 'react';
import axiosInstance from '@/utils/axios';
import { validateDate } from "@/utils/validation";
import { getCountryName, getAllCountriesOptions, getAllCountryNames } from '../../utils/helpers';
import { toast } from '@/hooks/use-toast';
import { crudAccess } from '@/utils/permissions';
import {
    employeePendingChangesForViewer,
    employeeRequiresEmiratesId,
} from '@/utils/employeeActivationSections';
// Import cards directly to test if DynamicCards re-exports are causing issues
import BasicDetailsCard from '../cards/BasicDetailsCard';
import PassportCard from '../cards/PassportCard';
import VisaCard from '../cards/VisaCard';
import EmiratesIdCard from '../cards/EmiratesIdCard';
import LabourCard from '../cards/LabourCard';
import MedicalInsuranceCard from '../cards/MedicalInsuranceCard';
import DrivingLicenseCard from '../cards/DrivingLicenseCard';
import VisaTypePickerModal from '../modals/VisaTypePickerModal';

export default function BasicTab({
    employee,
    employeeId,
    fetchEmployee,
    updateEmployeeOptimistically,
    getCountryName: getCountryNameProp,
    formatDate,
    isUAENationality,
    isVisaRequirementApplicable,
    onEditBasic,
    onViewDocument,
    onRequestNotRenew,
    viewerIsDesignatedFlowchartHr = false,
    viewerCanSeePendingActivationQueue = false,
    canApprovePendingNotRenew = false,
    onHrApproveNotRenew,
    onHrRejectNotRenewOpen,
    setViewingDocument,
    setShowDocumentViewer,
    isCompanyProfile,
    cardApisRef = null,
    canView = true,
    canEdit = true,
    canCreate = true,
}) {
    const [showVisaTypePicker, setShowVisaTypePicker] = useState(false);
    const passportCardRef = useRef(null);
    const emiratesIdCardRef = useRef(null);
    const visaCardRef = useRef(null);
    const medicalInsuranceCardRef = useRef(null);
    const labourCardRef = useRef(null);
    const drivingLicenseCardRef = useRef(null);


    // Get all countries for dropdown options - memoize to avoid recalculating on every render
    const allCountriesOptions = useMemo(() => getAllCountriesOptions(), []);
    const allCountryNamesList = useMemo(() => getAllCountryNames(), []);

    const visiblePendingChanges = useMemo(
        () => employeePendingChangesForViewer(employee, viewerCanSeePendingActivationQueue),
        [employee?.pendingReactivationChanges, viewerCanSeePendingActivationQueue],
    );

    useEffect(() => {
        const visaDetails = employee?.visaDetails || {};
        const pendingVisa =
            visiblePendingChanges.find((e) => String(e?.section || '').toLowerCase() === 'visa')?.proposedData || null;
        const hasAnyVisa = !!(
            visaDetails?.visit?.number ||
            visaDetails?.employment?.number ||
            visaDetails?.spouse?.number ||
            visaDetails?.number ||
            pendingVisa?.number
        );
        if (hasAnyVisa && showVisaTypePicker) {
            setShowVisaTypePicker(false);
        }
    }, [employee?.visaDetails, visiblePendingChanges, showVisaTypePicker]);

    useLayoutEffect(() => {
        if (!cardApisRef) return undefined;
        cardApisRef.current = {
            openPassportActivationHold: (proposed) =>
                passportCardRef.current?.openModalForActivationHold?.(proposed),
            openVisaActivationHold: (proposed) =>
                visaCardRef.current?.openModalForActivationHold?.(proposed),
            openEmiratesIdActivationHold: (proposed) =>
                emiratesIdCardRef.current?.openModalForActivationHold?.(proposed),
            openLabourCardActivationHold: (proposed) =>
                labourCardRef.current?.openModalForActivationHold?.(proposed),
            openMedicalInsuranceActivationHold: (proposed) =>
                medicalInsuranceCardRef.current?.openModalForActivationHold?.(proposed),
            openDrivingLicenseActivationHold: (proposed) =>
                drivingLicenseCardRef.current?.openModalForActivationHold?.(proposed),
        };
        return () => {
            cardApisRef.current = null;
        };
    }, [cardApisRef]);

    return (
        <div>

            <div className="space-y-6">
                {/* Masonry-style Column Flow Layout */}
                <div className="columns-1 lg:columns-2 gap-6 space-y-0">
                    {isCompanyProfile ? (
                        <>
                            <div className="break-inside-avoid mb-6">
                                <BasicDetailsCard
                                    employee={employee}
                                    getCountryName={getCountryName}
                                    formatDate={formatDate}
                                    onEdit={onEditBasic}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                            <div className="break-inside-avoid mb-6">
                                <PassportCard
                                    ref={passportCardRef}
                                    employee={employee}
                                    employeeId={employeeId}
                                    getCountryName={getCountryNameProp}
                                    formatDate={formatDate}
                                    fetchEmployee={fetchEmployee}
                                    updateEmployeeOptimistically={updateEmployeeOptimistically}
                                    onViewDocument={onViewDocument}
                                    onRequestNotRenew={onRequestNotRenew}
                                    viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                    viewerCanSeePendingActivationQueue={viewerCanSeePendingActivationQueue}
                                    canApprovePendingNotRenew={canApprovePendingNotRenew}
                                    onHrApproveNotRenew={onHrApproveNotRenew}
                                    onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                    setViewingDocument={setViewingDocument}
                                    setShowDocumentViewer={setShowDocumentViewer}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <div
                                id="basic-details"
                                className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_basic').view) ? '' : 'hidden'}`}
                            >
                                <BasicDetailsCard
                                    employee={employee}
                                    getCountryName={getCountryName}
                                    formatDate={formatDate}
                                    onEdit={onEditBasic}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                            <div
                                id="passport"
                                className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_passport').view) ? '' : 'hidden'}`}
                            >
                                <PassportCard
                                    ref={passportCardRef}
                                    employee={employee}
                                    employeeId={employeeId}
                                    getCountryName={getCountryNameProp}
                                    formatDate={formatDate}
                                    fetchEmployee={fetchEmployee}
                                    updateEmployeeOptimistically={updateEmployeeOptimistically}
                                    onViewDocument={onViewDocument}
                                    onRequestNotRenew={onRequestNotRenew}
                                    viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                    viewerCanSeePendingActivationQueue={viewerCanSeePendingActivationQueue}
                                    canApprovePendingNotRenew={canApprovePendingNotRenew}
                                    onHrApproveNotRenew={onHrApproveNotRenew}
                                    onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                    setViewingDocument={setViewingDocument}
                                    setShowDocumentViewer={setShowDocumentViewer}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                            {isVisaRequirementApplicable && (
                                <div
                                    id="visa"
                                    className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_visa').view) ? '' : 'hidden'}`}
                                >
                                    <VisaCard
                                        ref={visaCardRef}
                                        employee={employee}
                                        employeeId={employeeId}
                                        formatDate={formatDate}
                                        isUAENationality={isUAENationality}
                                        fetchEmployee={fetchEmployee}
                                        updateEmployeeOptimistically={updateEmployeeOptimistically}
                                        onViewDocument={onViewDocument}
                                        onRequestNotRenew={onRequestNotRenew}
                                        viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                        canApprovePendingNotRenew={canApprovePendingNotRenew}
                                        onHrApproveNotRenew={onHrApproveNotRenew}
                                        onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                        setShowDocumentViewer={setShowDocumentViewer}
                                        isCompanyProfile={isCompanyProfile}
                                    />
                                </div>
                            )}
                            <div
                                id="emirates-id"
                                className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_emirates_id').view) ? '' : 'hidden'}`}
                            >
                                <EmiratesIdCard
                                    ref={emiratesIdCardRef}
                                    employee={employee}
                                    employeeId={employeeId}
                                    formatDate={formatDate}
                                    fetchEmployee={fetchEmployee}
                                    updateEmployeeOptimistically={updateEmployeeOptimistically}
                                    onViewDocument={onViewDocument}
                                    onRequestNotRenew={onRequestNotRenew}
                                    viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                    viewerCanSeePendingActivationQueue={viewerCanSeePendingActivationQueue}
                                    canApprovePendingNotRenew={canApprovePendingNotRenew}
                                    onHrApproveNotRenew={onHrApproveNotRenew}
                                    onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                    setViewingDocument={setViewingDocument}
                                    setShowDocumentViewer={setShowDocumentViewer}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                            <div
                                id="labour-card"
                                className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_labour_card').view) ? '' : 'hidden'}`}
                            >
                                <LabourCard
                                    ref={labourCardRef}
                                    employee={employee}
                                    employeeId={employeeId}
                                    formatDate={formatDate}
                                    fetchEmployee={fetchEmployee}
                                    updateEmployeeOptimistically={updateEmployeeOptimistically}
                                    onViewDocument={onViewDocument}
                                    onRequestNotRenew={onRequestNotRenew}
                                    viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                    viewerCanSeePendingActivationQueue={viewerCanSeePendingActivationQueue}
                                    canApprovePendingNotRenew={canApprovePendingNotRenew}
                                    onHrApproveNotRenew={onHrApproveNotRenew}
                                    onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                    setViewingDocument={setViewingDocument}
                                    setShowDocumentViewer={setShowDocumentViewer}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                            <div
                                id="medical-insurance"
                                className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_medical_insurance').view) ? '' : 'hidden'}`}
                            >
                                <MedicalInsuranceCard
                                    ref={medicalInsuranceCardRef}
                                    employee={employee}
                                    employeeId={employeeId}
                                    formatDate={formatDate}
                                    fetchEmployee={fetchEmployee}
                                    updateEmployeeOptimistically={updateEmployeeOptimistically}
                                    onViewDocument={onViewDocument}
                                    onRequestNotRenew={onRequestNotRenew}
                                    viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                    viewerCanSeePendingActivationQueue={viewerCanSeePendingActivationQueue}
                                    canApprovePendingNotRenew={canApprovePendingNotRenew}
                                    onHrApproveNotRenew={onHrApproveNotRenew}
                                    onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                    setViewingDocument={setViewingDocument}
                                    setShowDocumentViewer={setShowDocumentViewer}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                            <div
                                id="driving-license"
                                className={`break-inside-avoid mb-6 ${(canView && crudAccess('hrm_employees_view_driving_license').view) ? '' : 'hidden'}`}
                            >
                                <DrivingLicenseCard
                                    ref={drivingLicenseCardRef}
                                    employee={employee}
                                    employeeId={employeeId}
                                    formatDate={formatDate}
                                    fetchEmployee={fetchEmployee}
                                    updateEmployeeOptimistically={updateEmployeeOptimistically}
                                    onViewDocument={onViewDocument}
                                    onRequestNotRenew={onRequestNotRenew}
                                    viewerIsDesignatedFlowchartHr={viewerIsDesignatedFlowchartHr}
                                    viewerCanSeePendingActivationQueue={viewerCanSeePendingActivationQueue}
                                    canApprovePendingNotRenew={canApprovePendingNotRenew}
                                    onHrApproveNotRenew={onHrApproveNotRenew}
                                    onHrRejectNotRenewOpen={onHrRejectNotRenewOpen}
                                    setViewingDocument={setViewingDocument}
                                    setShowDocumentViewer={setShowDocumentViewer}
                                    isCompanyProfile={isCompanyProfile}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Document Buttons */}
                {(() => {
                    const getPendingSectionData = (sectionName) => {
                        const sec = String(sectionName || '').toLowerCase();
                        const match = visiblePendingChanges.find((e) => String(e.section || '').toLowerCase() === sec);
                        return match?.proposedData || null;
                    };

                    if (isCompanyProfile) {
                        const documentButtons = [];
                        const effectivePassport = employee.passportDetails || getPendingSectionData('passport');
                        if (!effectivePassport?.number && crudAccess('hrm_company_view_owner_passport').create) {
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
                        if (documentButtons.length === 0) return null;
                        return (
                            <div className="mt-6">
                                <div className="flex flex-wrap gap-2" style={{ width: '550px' }}>
                                    {documentButtons}
                                </div>
                            </div>
                        );
                    }

                    const pendingVisa = getPendingSectionData('visa');
                    const visaDetails = employee?.visaDetails || {};
                    const pendingVisaType = String(pendingVisa?.visaType || pendingVisa?.type || '').toLowerCase();

                    // Support both nested visa shape (visit/employment/spouse) and legacy/pending flat shape.
                    const hasVisitVisa = !!(
                        visaDetails?.visit?.number ||
                        (pendingVisaType === 'visit' && pendingVisa?.number)
                    );
                    const hasEmploymentVisa = !!(
                        visaDetails?.employment?.number ||
                        (pendingVisaType === 'employment' && pendingVisa?.number)
                    );
                    const hasSpouseVisa = !!(
                        visaDetails?.spouse?.number ||
                        (pendingVisaType === 'spouse' && pendingVisa?.number)
                    );
                    const hasLegacyFlatVisa = !!visaDetails?.number;
                    const hasPendingFlatVisa = !!pendingVisa?.number;
                    const hasAnyVisa = !!(
                        hasVisitVisa ||
                        hasEmploymentVisa ||
                        hasSpouseVisa ||
                        hasLegacyFlatVisa ||
                        hasPendingFlatVisa
                    );

                    // User flow: once a visa is added, allow next document steps (EID/Labour/etc).
                    const isResident = !isVisaRequirementApplicable || hasAnyVisa;

                    const documentButtons = [];

                    const effectivePassport = employee.passportDetails || getPendingSectionData('passport');
                    if (!effectivePassport?.number && canCreate && crudAccess('hrm_employees_view_passport').create) {
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

                    if (isVisaRequirementApplicable && !hasAnyVisa && canCreate && crudAccess('hrm_employees_view_visa').create) {
                        documentButtons.push(
                            <button
                                key="visa"
                                type="button"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setShowVisaTypePicker(true);
                                }}
                                style={{ width: '92px' }}
                                className="px-4 py-2.5 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
                            >
                                Visa
                                <span className="text-sm leading-none font-bold">+</span>
                            </button>
                        );
                    }

                    const effectiveEmiratesId = employee.emiratesIdDetails || getPendingSectionData('emiratesid');
                    if (
                        isResident &&
                        employeeRequiresEmiratesId(employee, pendingVisa) &&
                        !effectiveEmiratesId?.number &&
                        canCreate &&
                        crudAccess('hrm_employees_view_emirates_id').create
                    ) {
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

                    const effectiveLabourCard = employee.labourCardDetails || getPendingSectionData('labourcard');
                    if (isResident && !effectiveLabourCard?.number && canCreate && crudAccess('hrm_employees_view_labour_card').create) {
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

                    const effectiveMedical = employee.medicalInsuranceDetails || getPendingSectionData('medicalinsurance');
                    if ((isResident || hasVisitVisa) && !effectiveMedical?.provider && canCreate && crudAccess('hrm_employees_view_medical_insurance').create) {
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

                    const effectiveDriving = employee.drivingLicenceDetails || getPendingSectionData('drivinglicense');
                    if ((isResident || hasVisitVisa) && !effectiveDriving?.number && canCreate && crudAccess('hrm_employees_view_driving_license').create) {
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

            <VisaTypePickerModal
                isOpen={showVisaTypePicker}
                onClose={() => setShowVisaTypePicker(false)}
                onSelect={(visaType) => {
                    setShowVisaTypePicker(false);
                    visaCardRef.current?.openModal?.(visaType);
                }}
            />
        </div>
    );
}


