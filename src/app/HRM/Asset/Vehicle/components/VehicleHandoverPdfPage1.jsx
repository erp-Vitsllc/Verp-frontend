'use client';

import {
    PDF_INK,
    PDF_PAGE1_CELL_CLASS,
    PDF_PAGE1_CLASS,
    PDF_PAGE1_FONT_FAMILY,
    PDF_SECTION_EMPHASIS_CLASS,
} from '../utils/vehicleHandoverFormPdfConstants';
import { VEHICLE_HANDOVER_POLICY_BLOCKS } from '../utils/vehicleHandoverPdfPolicyBlocks';
import { VehicleHandoverPolicyTitle } from './VehicleHandoverPdfTitles';

const PAGE1_CELL = PDF_PAGE1_CELL_CLASS;

function TableLabelCell({ children }) {
    return <td className={PAGE1_CELL}>{children}</td>;
}

function TableValueCell({ children }) {
    const display = !children || children === '—' ? '' : children;
    return <td className={PAGE1_CELL}>{display}</td>;
}

function TableEmptyCell() {
    return <td className={`${PAGE1_CELL} h-6`}>&nbsp;</td>;
}

function TableRow({ row }) {
    return (
        <tr>
            <TableLabelCell>{row[0]}</TableLabelCell>
            <TableValueCell>{row[1]}</TableValueCell>
            <TableLabelCell>{row[2]}</TableLabelCell>
            <TableValueCell>{row[3]}</TableValueCell>
            <TableLabelCell>{row[4]}</TableLabelCell>
            <TableValueCell>{row[5]}</TableValueCell>
        </tr>
    );
}

export function PolicySection({ heading, children }) {
    return (
        <p className="text-[10.5pt] leading-[1.35]">
            <span className={PDF_SECTION_EMPHASIS_CLASS}>{heading}</span>
            {children}
        </p>
    );
}

export function VehicleHandoverPdfPolicyBlocks({ blockIds = null, className = '' }) {
    const idSet = Array.isArray(blockIds) ? new Set(blockIds) : null;
    const blocks = VEHICLE_HANDOVER_POLICY_BLOCKS.filter((block) =>
        idSet ? idSet.has(block.id) : true,
    );

    if (!blocks.length) return null;

    return (
        <div className={`space-y-2 text-left ${className}`}>
            {blocks.map((block) => {
                if (block.type === 'paragraph') {
                    return (
                        <p
                            key={block.id}
                            data-pdf-policy-block={block.id}
                            className="text-[10.5pt] leading-[1.35]"
                        >
                            {block.text}
                        </p>
                    );
                }
                return (
                    <div key={block.id} data-pdf-policy-block={block.id}>
                        <PolicySection heading={block.heading}>{block.text}</PolicySection>
                    </div>
                );
            })}
        </div>
    );
}

export function VehicleHandoverPdfPage1Styles() {
    return (
        <style jsx global>{`
            .${PDF_PAGE1_CLASS} * {
                font-family: ${PDF_PAGE1_FONT_FAMILY} !important;
                color: ${PDF_INK};
            }
            .${PDF_PAGE1_CLASS} span {
                font-size: inherit !important;
            }
        `}</style>
    );
}

export function VehicleHandoverPdfPage1HeaderTable({ headerTable }) {
    const firstRow = [
        'Vehicle NO',
        headerTable.vehicleNo,
        'Model',
        headerTable.model,
        'Year',
        headerTable.year,
    ];
    const bodyRows = [
        ['Asset No', headerTable.assetNo, 'Brand', headerTable.brand, 'Reg Expiry', headerTable.regExpiry],
        [
            'Handover By',
            headerTable.handoverBy,
            'Hand Over to',
            headerTable.handoverTo,
            'Warranty',
            headerTable.warranty,
        ],
        [
            'Current KM',
            headerTable.currentKm || headerTable.currentUsage,
            'Hand Over Date',
            headerTable.handoverDate,
            'Driving License Age',
            headerTable.drivingLicenseAge,
        ],
        [
            'Vehicle Value',
            headerTable.vehicleValue,
            'Insurance by',
            headerTable.insuranceBy,
            'Insurance Expiry',
            headerTable.insuranceExpiry,
        ],
    ];

    return (
        <table className="w-full border-collapse" data-pdf-page1-header-table="true">
            <tbody>
                <TableRow row={firstRow} />
                {bodyRows.map((row) => (
                    <TableRow key={row[0]} row={row} />
                ))}
                <tr>
                    <TableEmptyCell />
                    <TableEmptyCell />
                    <TableEmptyCell />
                    <TableEmptyCell />
                    <TableEmptyCell />
                    <TableEmptyCell />
                </tr>
            </tbody>
        </table>
    );
}

export default function VehicleHandoverPdfPage1({
    headerTable,
    policyBlockIds = null,
    className = '',
}) {
    return (
        <div className={`${PDF_PAGE1_CLASS} flex h-full min-h-0 flex-col overflow-hidden ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <VehicleHandoverPolicyTitle className="mb-6 shrink-0" />

            <div className="shrink-0">
                <VehicleHandoverPdfPage1HeaderTable headerTable={headerTable} />
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-hidden">
                <VehicleHandoverPdfPolicyBlocks blockIds={policyBlockIds} />
            </div>
        </div>
    );
}
