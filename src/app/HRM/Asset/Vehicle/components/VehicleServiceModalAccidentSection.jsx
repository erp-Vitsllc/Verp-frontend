'use client';

import { useEffect, useMemo, useState } from 'react';
import axiosInstance from '@/utils/axios';
import VehicleAccidentRepairForm, { formatDisplayDate } from './VehicleAccidentRepairForm';
import { getPreviousVehicleServiceDate, vehicleServiceHistoryHref } from './vehicleServiceHistoryUtils';

/**
 * Accident repair create / HR-review form used inside VehicleServiceModal.
 */
export default function VehicleServiceModalAccidentSection({
    assetId,
    assetDetail,
    setAssetDetail,
    formData,
    set,
    errors,
    employees,
    assetControllerName,
    ASSET_CONTROLLER_VALUE,
    resolvedAssetControllerEmployeeId,
    hasResolvedControllerInEmployees,
    isAddServiceMode,
    isHrApprovalStep,
    embedMode,
    loading,
    onSaveDraft,
    onCancel,
    onCreateRequest,
    handleFileChange,
    appendAccidentImagesFromFiles,
    appendNewConditionImagesFromFiles,
    setLightboxSrc,
    openPreviousServicesModal,
}) {
    const [companies, setCompanies] = useState([]);

    useEffect(() => {
        let cancelled = false;
        axiosInstance
            .get('/Company')
            .then(({ data }) => {
                if (!cancelled) setCompanies(data?.companies || data || []);
            })
            .catch(() => {
                if (!cancelled) setCompanies([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!assetId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await axiosInstance.get(`/AssetItem/detail/${assetId}`);
                if (!cancelled) setAssetDetail(res.data || null);
            } catch {
                if (!cancelled) setAssetDetail(null);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [assetId, setAssetDetail]);

    useEffect(() => {
        if (!assetDetail?.documents) return;
        const insDocs = assetDetail.documents.filter((d) => d.type === 'Insurance');
        if (!insDocs.length) return;
        insDocs.sort((a, b) => new Date(b.issueDate || b.createdAt) - new Date(a.issueDate || a.createdAt));
        const doc = insDocs[0];
        let parsed = {};
        try {
            parsed = doc.description ? JSON.parse(doc.description) : {};
        } catch {
            parsed = {};
        }
        if (!formData.insuranceCompany) set('insuranceCompany', parsed.company || doc.issueAuthority || '');
        if (!formData.policyNumber) set('policyNumber', parsed.policy || '');
        if (!formData.insuranceExpiryDate && doc.expiryDate) {
            set('insuranceExpiryDate', new Date(doc.expiryDate).toISOString().slice(0, 10));
        }
        if (formData.accidentOwnerType !== 'thirdParty' && formData.insuranceFineAmount === '' && parsed.excessCharge != null) {
            set('insuranceFineAmount', String(parsed.excessCharge));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autofill once per asset load
    }, [assetDetail?._id]);

    const headerDateLabel = useMemo(() => {
        const base = isAddServiceMode ? new Date() : formData.date;
        return formatDisplayDate(base);
    }, [isAddServiceMode, formData.date]);

    const previousInfo = useMemo(
        () =>
            getPreviousVehicleServiceDate(assetDetail?.services, {
                serviceType: 'Accident Repair',
                excludeServiceId: null,
            }),
        [assetDetail?.services],
    );

    const onViewHistory = () => {
        if (typeof openPreviousServicesModal === 'function') {
            openPreviousServicesModal();
            return;
        }
        if (assetId && typeof window !== 'undefined') {
            window.open(vehicleServiceHistoryHref(assetId), '_blank', 'noopener,noreferrer');
        }
    };

    const isCreatorMode = !embedMode;

    return (
        <VehicleAccidentRepairForm
            formData={formData}
            set={set}
            errors={errors}
            employees={employees}
            companies={companies}
            assetControllerName={assetControllerName}
            ASSET_CONTROLLER_VALUE={ASSET_CONTROLLER_VALUE}
            resolvedAssetControllerEmployeeId={resolvedAssetControllerEmployeeId}
            hasResolvedControllerInEmployees={hasResolvedControllerInEmployees}
            headerDateLabel={headerDateLabel}
            previousAccidentDate={previousInfo.date}
            previousAccidentDateLabel={previousInfo.label || 'Previous Accident Date'}
            onViewHistory={onViewHistory}
            onCreateRequest={onCreateRequest}
            handleFileChange={handleFileChange}
            appendAccidentImagesFromFiles={appendAccidentImagesFromFiles}
            appendNewConditionImagesFromFiles={appendNewConditionImagesFromFiles}
            setLightboxSrc={setLightboxSrc}
            onSaveDraft={onSaveDraft}
            onCancel={onCancel}
            loading={loading}
            hideSectionActions={embedMode}
            readOnlyAccident={embedMode && isHrApprovalStep}
            showGarageSection={!isCreatorMode}
            showReturnSection={!isCreatorMode}
            showCreatorActions={isCreatorMode}
            showGarageActions={false}
            showReturnActions={false}
        />
    );
}
