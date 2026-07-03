'use client';

import { useMemo } from 'react';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import { buildOilServiceDetailWorkflowEvents } from '../utils/vehicleOilServiceDetailWorkflow';
import { buildTireChangeDetailWorkflowEvents } from '../utils/vehicleTireChangeDetailWorkflow';
import { vehicleServiceTypeKey } from '../components/vehicleServiceUtils';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';

const { card, timeline, steps, header, list, text, connector, spread } =
    VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

const TIRE_SUBTITLE =
    'Service created, updated, submitted, quotation review, garage, accounts, and completion';
const OIL_SUBTITLE =
    'Service created, updated, scheduled, on service, and end service';

export default function VehicleOilServiceWorkflowPanel({ asset, service, className = '' }) {
    const isTireChange = vehicleServiceTypeKey(service) === 'Tire Change';

    const events = useMemo(() => {
        if (isTireChange) {
            return buildTireChangeDetailWorkflowEvents(asset, service);
        }
        return buildOilServiceDetailWorkflowEvents(asset, service);
    }, [asset, service, isTireChange]);

    const cardHeightClass = className.includes('flex-1') || className.includes('h-full')
        ? 'h-full min-h-0 flex-1'
        : card.stretchFullHeight
          ? 'h-full min-h-0'
          : '';

    return (
        <div
            className={`flex w-full flex-col ${cardHeightClass} ${card.roundedClass} ${card.borderClass} ${card.backgroundClass} ${card.paddingClass} ${className}`}
        >
            <WorkflowHistoryTimeline
                title="Service Workflow History"
                subtitle={isTireChange ? TIRE_SUBTITLE : OIL_SUBTITLE}
                emptyMessage="No workflow activity recorded yet."
                size={timeline.size}
                verticalSpread={timeline.verticalSpread}
                className={timeline.verticalSpread ? 'min-h-0 flex-1' : ''}
                layoutConfig={{
                    verticalSpread: timeline.verticalSpread,
                    steps,
                    header,
                    list,
                    text,
                    connector,
                    spread,
                }}
                events={events}
            />
        </div>
    );
}
