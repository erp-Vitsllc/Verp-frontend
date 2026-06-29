'use client';

import { PDF_ACCESSORY_LABELS, PDF_PAGE1_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { resolveAssessmentMediaUrl } from '../utils/vehicleHandoverReceiverAssessment';
import { VehicleHandoverPdfPage1Styles } from './VehicleHandoverPdfPage1';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';
import {
    PDF_ACCESSORY_PHOTO_HEIGHT,
    PDF_CELL,
    PDF_TABLE,
    PdfBodyConditionTable,
} from './VehicleHandoverPdfBodyConditionPage';
import { VehicleHandoverAssessmentTitle } from './VehicleHandoverPdfTitles';
import VehicleHandoverPdfClosingSection from './VehicleHandoverPdfClosingSection';

function chunkAccessoryPairs(rows) {
    const pairs = [];
    for (let i = 0; i < rows.length; i += 2) {
        pairs.push({ left: rows[i], right: rows[i + 1] || null });
    }
    return pairs;
}

function PdfAccessoryCell({ row }) {
    if (!row) {
        return <td className={PDF_CELL}>&nbsp;</td>;
    }

    const label = PDF_ACCESSORY_LABELS[row.key] || `${row.label}.`;
    const statusLabel =
        row.present === true ? 'Yes' : row.present === false ? 'No' : '—';
    const photoUrl = row.present === true ? resolveAssessmentMediaUrl(row.photo) : null;

    return (
        <td className={PDF_CELL}>
            <p className="text-[11pt] font-bold">
                {label} {statusLabel}
            </p>
            {photoUrl ? (
                <div className="mt-2">
                    <VehicleHandoverAssessmentPhotoPanel
                        url={photoUrl}
                        label={label}
                        sizeClass="w-full max-w-full"
                        borderClass="border-0"
                        roundedClass="rounded-none"
                        heightClass={PDF_ACCESSORY_PHOTO_HEIGHT}
                    />
                </div>
            ) : null}
        </td>
    );
}

function PdfAccessoriesTable({ rows }) {
    const pairs = chunkAccessoryPairs(rows);

    return (
        <table className={`${PDF_TABLE} mb-0`}>
            <tbody>
                <tr>
                    <td
                        colSpan={2}
                        className={`${PDF_CELL} text-center text-[11pt] font-bold`}
                    >
                        Accessories List
                    </td>
                </tr>
                {pairs.map((pair) => (
                    <tr key={pair.left.key}>
                        <PdfAccessoryCell row={pair.left} />
                        <PdfAccessoryCell row={pair.right} />
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function VehicleHandoverPdfPage3({
    accessories,
    bodyConditionPairs = [],
    showClosingSection = false,
    additionalInfo = '',
    receiver,
    officeUse,
    className = '',
}) {
    return (
        <div className={`${PDF_PAGE1_CLASS} h-full ${className}`}>
            <VehicleHandoverPdfPage1Styles />

            <VehicleHandoverAssessmentTitle />

            <PdfAccessoriesTable rows={accessories} />

            {bodyConditionPairs.length > 0 ? (
                <PdfBodyConditionTable
                    pairs={bodyConditionPairs}
                    showTitleRow
                    className="mt-3"
                />
            ) : null}

            {showClosingSection && receiver && officeUse ? (
                <VehicleHandoverPdfClosingSection
                    additionalInfo={additionalInfo}
                    receiver={receiver}
                    officeUse={officeUse}
                />
            ) : null}
        </div>
    );
}
