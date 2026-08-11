'use client';

import { PDF_ACCESSORY_LABELS, PDF_CELL_LABEL_CLASS, PDF_CELL_STYLE, PDF_TABLE_HEADER_CLASS, PDF_TABLE_STYLE } from '../utils/vehicleHandoverFormPdfConstants';
import VehicleHandoverPdfAssessmentPhoto from './VehicleHandoverPdfAssessmentPhoto';
import { PDF_ACCESSORY_PHOTO_HEIGHT, PDF_CELL, PDF_TABLE } from './VehicleHandoverPdfBodyConditionPage';

function chunkAccessoryPairs(rows) {
    const pairs = [];
    for (let i = 0; i < rows.length; i += 2) {
        pairs.push({ left: rows[i], right: rows[i + 1] || null });
    }
    return pairs;
}

function PdfAccessoryCell({ row, photoHeight = PDF_ACCESSORY_PHOTO_HEIGHT }) {
    if (!row) {
        return (
            <td className={`${PDF_CELL} align-top p-1.5`} style={PDF_CELL_STYLE}>
                <p className={`${PDF_CELL_LABEL_CLASS} mb-1`}>&nbsp;</p>
                <p className="mt-0.5 text-[9pt] font-semibold uppercase tracking-wide text-slate-600">
                    Comment
                </p>
                <p className="mb-1 min-h-[16px] border-b border-black pb-0.5 text-[10pt] leading-snug">
                    &nbsp;
                </p>
                <VehicleHandoverPdfAssessmentPhoto
                    photo={null}
                    label=""
                    heightClass={photoHeight}
                />
            </td>
        );
    }

    const label = PDF_ACCESSORY_LABELS[row.key] || `${row.label}.`;
    const statusLabel =
        row.present === true ? 'Yes' : row.present === false ? 'No' : '—';
    const comment = String(row.comment || row.notes || '').trim();

    return (
        <td className={`${PDF_CELL} align-top p-1.5`} style={PDF_CELL_STYLE}>
            <p className={`${PDF_CELL_LABEL_CLASS} mb-1`}>
                {label} {statusLabel}
            </p>
            <p className="mt-0.5 text-[9pt] font-semibold uppercase tracking-wide text-slate-600">
                Comment
            </p>
            <p className="mb-1 min-h-[16px] border-b border-black pb-0.5 text-[10pt] leading-snug">
                {comment || '\u00A0'}
            </p>
            <VehicleHandoverPdfAssessmentPhoto
                photo={row.present === true ? row.photo : null}
                label={label}
                heightClass={photoHeight}
            />
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
        <table className={`${PDF_TABLE} mb-0 ${className}`} style={PDF_TABLE_STYLE}>
            <tbody>
                <tr>
                    <td
                        colSpan={2}
                        className={`${PDF_CELL} ${PDF_TABLE_HEADER_CLASS}`}
                        style={PDF_CELL_STYLE}
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
