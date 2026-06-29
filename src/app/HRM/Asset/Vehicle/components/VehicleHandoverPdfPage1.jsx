'use client';

import { PDF_INK, PDF_PAGE1_CLASS, PDF_PAGE1_FONT_FAMILY } from '../utils/vehicleHandoverFormPdfConstants';
import { VehicleHandoverPolicyTitle } from './VehicleHandoverPdfTitles';

const PAGE1_CELL = 'border border-black px-1.5 py-1 text-center align-middle text-[10.5pt] font-normal';

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

function PolicySection({ heading, children }) {
    return (
        <p className="text-[10.5pt] leading-[1.35]">
            <span className="font-bold">{heading}</span>
            {children}
        </p>
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

export default function VehicleHandoverPdfPage1({ headerTable, className = '' }) {
    const firstRow = ['Vehicle NO', headerTable.vehicleNo, 'Model', headerTable.model, 'Year', headerTable.year];
    const bodyRows = [
        ['Asset No', headerTable.assetNo, 'Brand', headerTable.brand, 'Reg Expiry', headerTable.regExpiry],
        ['Handover By', headerTable.handoverBy, 'Hand Over to', headerTable.handoverTo, 'Warranty', headerTable.warranty],
        ['Current Usage', headerTable.currentUsage, 'Hand Over Date', headerTable.handoverDate, 'Driving License Age', headerTable.drivingLicenseAge],
        ['Vehicle Value', headerTable.vehicleValue, 'Insurance by', headerTable.insuranceBy, 'Insurance Expiry', headerTable.insuranceExpiry],
    ];

    return (
        <div className={`${PDF_PAGE1_CLASS} flex h-full flex-col pt-[6mm] ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <VehicleHandoverPolicyTitle className="mb-10" />

            <table className="w-full border-collapse">
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

            <div className="mt-4 space-y-2 text-left">
                    <p className="text-[10.5pt] leading-[1.35]">
                        This Vehicle Usage Policy outlines the guidelines and responsibilities for employees using
                        company vehicles, especially when they are used for personal purposes outside of office hours.
                        The policy also addresses the procedures to be followed in case of accidents and the driver&apos;s
                        financial responsibility during garage downtime.
                    </p>

                    <PolicySection heading="Vehicle Assignment:">
                        {' '}
                        Vehicles are provided solely for business purposes.
                    </PolicySection>

                    <PolicySection heading="Personal Use:">
                        {' '}
                        Employees may use company vehicles for personal purposes which includes picking and dropping off
                        at the airport or any other personal errands outside office hours only after informing{' '}
                        <span className="underline">HR Personal</span>
                        {' '}use of vehicle is a privilege not an entitlement. Misuse may result in disciplinary action.
                    </PolicySection>

                    <PolicySection heading="Accident:">
                        {' '}
                        In the event of any accident outside office hours, assigned employee / driver must report it to{' '}
                        <span className="underline">HR providing</span>
                        {' '}all relevant information and documents.
                    </PolicySection>

                    <PolicySection heading="Financial Responsibility during garage time:">
                        {' '}
                        If the unavailability of vehicle is due to an accident caused by driver&apos;s negligence, the
                        driver is responsible for any repair or rental car costs incurred during the garage time.
                    </PolicySection>

                    <PolicySection heading="Premium Adjustments/ Total Loss:">
                        {' '}
                        If an employee&apos;s driving record leads to increased insurance premiums for the company or
                        reduces the amount recoverable in the event of a total loss, the employee may be required to
                        contribute to these costs. The contribution amount will be determined based on the increase in
                        premiums directly attributed to the employee&apos;s driving record
                    </PolicySection>

                    <PolicySection heading="Liability Caps:">
                        {' '}
                        Employees will be financially responsible for all damages resulting from accidents where their
                        negligence is proven. This applies to both company vehicle and third- party claims
                    </PolicySection>

                    <PolicySection heading="Usage Fees:">
                        {' '}
                        For employees with a history of frequent accidents (2 and above in a year), a nominal usage fee
                        of AED 1000 will be deducted from their salary. This fee is intended to contribute towards
                        maintenance and operational costs associated with their use of company vehicles.
                    </PolicySection>

                    <PolicySection heading="Repair Costs:">
                        {' '}
                        If an employee is found at fault for an accident, they may be required to cover the full amount of
                        vehicle repair costs. This will be assessed based on the extent of the damage and repair needs.
                    </PolicySection>

                    <PolicySection heading="Maintenance & Cleanliness:">
                        {' '}
                        Assigned employee is responsible for ensuring the cleanliness and proper maintenance of the Vehicle
                        they use at all times. Vehicles used for picking and dropping employees at the site must be washed
                        twice while other vehicles should be washed once. Company will reimburse the bill once it is
                        submitted.
                    </PolicySection>
                </div>
        </div>
    );
}
