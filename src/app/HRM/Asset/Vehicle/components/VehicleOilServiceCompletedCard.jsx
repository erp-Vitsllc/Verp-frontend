'use client';

import { ClipboardCheck } from 'lucide-react';
import { FineFormCard } from '@/app/HRM/Fine/components/FineFormCardShared';
import VehicleShopServiceExtendDateSection from './VehicleShopServiceExtendDateSection';
import { shouldShowServiceCompletedCard } from '../utils/vehicleShopServiceExtendDate';
import { isOilServiceAssignmentPending } from '../utils/vehicleOilServiceAccess';
import { parseVehicleServiceRemark } from './vehicleServiceUtils';
import { tireDatePickerClass } from '../utils/vehicleAccidentRepairDetailUi';

export default function VehicleOilServiceCompletedCard({
    asset,
    service,
    vehicleId,
    serviceId,
    canManage = false,
    workflowStage = '',
    onUpdated,
    className = '',
}) {
    const remark = parseVehicleServiceRemark(service) || {};
    const assignmentPending = isOilServiceAssignmentPending(remark);

    if (!shouldShowServiceCompletedCard(service, assignmentPending, workflowStage)) {
        return null;
    }

    return (
        <div className={`w-full ${className}`.trim()}>
            <FineFormCard
                title="Extend Date"
                subtitle="Extend the service end date when more time is needed before completion."
                icon={ClipboardCheck}
                iconBg="bg-teal-50"
                iconColor="text-teal-600"
                className="w-full"
            >
                <VehicleShopServiceExtendDateSection
                    asset={asset}
                    service={service}
                    vehicleId={vehicleId}
                    serviceId={serviceId}
                    canManage={canManage}
                    workflowStage={workflowStage}
                    onUpdated={onUpdated}
                    datePickerClass={tireDatePickerClass}
                />
            </FineFormCard>
        </div>
    );
}
