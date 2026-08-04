'use client';

import { useEffect, useMemo, useState } from 'react';
import WorkflowHistoryTimeline from '@/app/HRM/shared/workflowHistory/WorkflowHistoryTimeline';
import {
    buildOilServiceDetailWorkflowEvents,
    isOilServiceCashAmountMode,
} from '../utils/vehicleOilServiceDetailWorkflow';
import { buildTireChangeDetailWorkflowEvents } from '../utils/vehicleTireChangeDetailWorkflow';
import { SHOP_SERVICE_WORKFLOW_SUBTITLE } from '../utils/vehicleShopServiceDetailWorkflow';
import { parseVehicleServiceRemark, vehicleServiceTypeKey } from '../components/vehicleServiceUtils';
import { VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG } from '../utils/vehicleHandoverAssignWorkflowTrackerConfig';
import { fetchFlowchartRows } from '@/utils/flowchartRowsCache';

const { card, timeline, steps, header, list, text, connector, spread } =
    VEHICLE_HANDOVER_ASSIGN_WORKFLOW_TRACKER_CONFIG;

const OIL_SUBTITLE = SHOP_SERVICE_WORKFLOW_SUBTITLE;
const OIL_WARRANTY_SUBTITLE = 'Initiate, Schedule, On Service, and Complete Service';

export default function VehicleOilServiceWorkflowPanel({
    asset,
    service,
    flowchartRows: flowchartRowsProp,
    className = '',
}) {
    const isTireChange = vehicleServiceTypeKey(service) === 'Tire Change';
    const [flowchartRowsLocal, setFlowchartRowsLocal] = useState(() =>
        Array.isArray(flowchartRowsProp) ? flowchartRowsProp : [],
    );

    useEffect(() => {
        if (Array.isArray(flowchartRowsProp) && flowchartRowsProp.length > 0) {
            setFlowchartRowsLocal(flowchartRowsProp);
            return undefined;
        }
        let cancelled = false;
        fetchFlowchartRows()
            .then((rows) => {
                if (!cancelled) setFlowchartRowsLocal(rows);
            })
            .catch(() => {
                if (!cancelled) setFlowchartRowsLocal([]);
            });
        return () => {
            cancelled = true;
        };
    }, [flowchartRowsProp]);

    const flowchartRows =
        Array.isArray(flowchartRowsProp) && flowchartRowsProp.length > 0
            ? flowchartRowsProp
            : flowchartRowsLocal;

    const isOilCash = useMemo(() => {
        if (isTireChange) return false;
        return isOilServiceCashAmountMode(parseVehicleServiceRemark(service) || {});
    }, [isTireChange, service]);

    const events = useMemo(() => {
        if (isTireChange) {
            return buildTireChangeDetailWorkflowEvents(asset, service, flowchartRows);
        }
        return buildOilServiceDetailWorkflowEvents(asset, service, flowchartRows);
    }, [asset, service, isTireChange, flowchartRows]);

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
                subtitle={isTireChange ? OIL_SUBTITLE : isOilCash ? OIL_SUBTITLE : OIL_WARRANTY_SUBTITLE}
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

