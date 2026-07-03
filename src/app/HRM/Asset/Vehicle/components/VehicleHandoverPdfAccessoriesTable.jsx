'use client';

import { PDF_ACCESSORY_LABELS, PDF_CELL_LABEL_CLASS, PDF_TABLE_HEADER_CLASS } from '../utils/vehicleHandoverFormPdfConstants';
import { resolveAssessmentMediaUrl } from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';
import { PDF_ACCESSORY_PHOTO_HEIGHT, PDF_CELL, PDF_TABLE } from './VehicleHandoverPdfBodyConditionPage';

function chunkAccessoryPairs(rows) {
    const pairs = [];
    for (let i = 0; i < rows.length; i += 2) {
        pairs.push({ left: rows[i], right: rows[i + 1] || null });
    }
    return pairs;
}

function PdfAccessoryPhotoSlot({ photoUrl, label, photoHeight }) {
    return (
        <div className="mt-1 leading-none">
            {photoUrl ? (
                <VehicleHandoverAssessmentPhotoPanel
                    url={photoUrl}
                    label={label}
                    sizeClass="w-full max-w-full"
                    borderClass="border-0"
                    roundedClass="rounded-none"
                    heightClass={photoHeight}
                />
            ) : (
                <div className={`w-full ${photoHeight} bg-white`} aria-hidden="true" />
            )}
        </div>
    );
}

function PdfAccessoryCell({ row, photoHeight = PDF_ACCESSORY_PHOTO_HEIGHT }) {
    if (!row) {
        return (
            <td className={`${PDF_CELL} align-top p-1.5`}>
                <p className={`${PDF_CELL_LABEL_CLASS} mb-1`}>&nbsp;</p>
                <PdfAccessoryPhotoSlot photoUrl={null} label="" photoHeight={photoHeight} />
            </td>
        );
    }

    const label = PDF_ACCESSORY_LABELS[row.key] || `${row.label}.`;
    const statusLabel =
        row.present === true ? 'Yes' : row.present === false ? 'No' : '—';
    const photoUrl = row.present === true ? resolveAssessmentMediaUrl(row.photo) : null;

    return (
        <td className={`${PDF_CELL} align-top p-1.5`}>
            <p className={`${PDF_CELL_LABEL_CLASS} mb-1`}>
                {label} {statusLabel}
            </p>
            <PdfAccessoryPhotoSlot photoUrl={photoUrl} label={label} photoHeight={photoHeight} />
        </td>
    );
}

export function PdfAccessoriesTable({
    rows,
    className = '',
    photoHeight = PDF_ACCESSORY_PHOTO_HEIGHT,
}) {
    const pairs = chunkAccessoryPairs(rows);

    return (
        <table className={`${PDF_TABLE} mb-0 ${className}`}>
            <tbody>
                <tr>
                    <td
                        colSpan={2}
                        className={`${PDF_CELL} ${PDF_TABLE_HEADER_CLASS}`}
                    >
                        Accessories List
                    </td>
                </tr>
                {pairs.map((pair) => (
                    <tr key={pair.left.key}>
                        <PdfAccessoryCell row={pair.left} photoHeight={photoHeight} />
                        <PdfAccessoryCell row={pair.right} photoHeight={photoHeight} />
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
