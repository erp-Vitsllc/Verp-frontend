'use client';

import VehicleOilServiceWorkflowPanel from './VehicleOilServiceWorkflowPanel';
import VehicleOilServicePreviousHistoryPanel from './VehicleOilServicePreviousHistoryPanel';

export default function VehicleOilServiceHistoryPanels({ asset, service, className = '' }) {
    return (
        <div className={`flex w-full flex-col gap-6 lg:flex-row lg:items-stretch ${className}`}>
            <VehicleOilServiceWorkflowPanel
                asset={asset}
                service={service}
                className="min-h-0 flex-1 min-w-0"
            />
            <VehicleOilServicePreviousHistoryPanel
                asset={asset}
                service={service}
                className="min-h-0 flex-1 min-w-0"
            />
        </div>
    );
}
