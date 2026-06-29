'use client';

import React from 'react';
import {
    PDF_ACCESSORY_LABELS,
    PDF_BODY_CONDITION_LABELS,
    PDF_DOCUMENT_TITLE_SKIN,
    PDF_FONT_FAMILY,
    PDF_INK,
    PDF_LINK,
    PDF_PAGE1_CLASS,
    PDF_ROOT_CLASS,
} from '../utils/vehicleHandoverFormPdfConstants';
import { resolveAssessmentMediaUrl } from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';

export function VehicleHandoverPdfThemeStyles() {
    return (
        <style jsx global>{`
            .${PDF_ROOT_CLASS} {
                font-family: ${PDF_FONT_FAMILY} !important;
                color: ${PDF_INK} !important;
                font-size: 11pt;
                line-height: 1.35;
                -webkit-font-smoothing: antialiased;
            }
            .${PDF_ROOT_CLASS} *:not(.vhf-ui-action):not(.vhf-ui-action *):not(.${PDF_PAGE1_CLASS}):not(.${PDF_PAGE1_CLASS} *) {
                font-family: ${PDF_FONT_FAMILY} !important;
            }
            .${PDF_ROOT_CLASS} h1,
            .${PDF_ROOT_CLASS} h2,
            .${PDF_ROOT_CLASS} h3,
            .${PDF_ROOT_CLASS} p,
            .${PDF_ROOT_CLASS} span,
            .${PDF_ROOT_CLASS} td,
            .${PDF_ROOT_CLASS} th,
            .${PDF_ROOT_CLASS} label,
            .${PDF_ROOT_CLASS} div {
                color: ${PDF_INK};
            }
            .${PDF_ROOT_CLASS} .vhf-pdf-link {
                color: ${PDF_LINK} !important;
                text-decoration: underline;
            }
            /* globals.css sets span { font-size: 16px } — keep PDF text uniform */
            .${PDF_ROOT_CLASS} span {
                font-size: inherit !important;
                color: inherit;
            }
            .${PDF_ROOT_CLASS} h1.${PDF_DOCUMENT_TITLE_SKIN},
            .${PDF_ROOT_CLASS} h1.${PDF_DOCUMENT_TITLE_SKIN} span {
                font-size: 16pt !important;
                font-weight: 700 !important;
                color: ${PDF_INK} !important;
            }
        `}</style>
    );
}

export const PdfRoot = React.forwardRef(function PdfRoot({ children, className = '', id }, ref) {
    return (
        <div ref={ref} id={id} className={`${PDF_ROOT_CLASS} ${className}`}>
            <VehicleHandoverPdfThemeStyles />
            {children}
        </div>
    );
});

export function PdfSectionTitle({ children, className = '' }) {
    return (
        <h2 className={`text-[12pt] font-bold uppercase leading-tight ${className}`}>
            {children}
        </h2>
    );
}

export function PdfSubTitle({ children, className = '' }) {
    return (
        <h3 className={`text-[11pt] font-bold uppercase leading-tight ${className}`}>
            {children}
        </h3>
    );
}

export function PdfPhotoBlock({ photoUrl, label, onPhotoClick }) {
    return (
        <div className="mt-1">
            <p className="text-[11pt]">
                Upload photo
            </p>
            <div className="mt-1 max-w-[148px]">
                {photoUrl ? (
                    <VehicleHandoverAssessmentPhotoPanel
                        url={photoUrl}
                        label={label}
                        onClick={onPhotoClick}
                        sizeClass="w-full max-w-[148px]"
                        borderClass="border-black"
                        roundedClass="rounded-none"
                    />
                ) : (
                    <div className="flex aspect-square w-full max-w-[148px] items-center justify-center border border-black bg-white p-2 text-center text-[10pt]">
                        Option to Click to Open file as album
                    </div>
                )}
            </div>
        </div>
    );
}

export function PdfAccessoryRow({ row, onPhotoClick }) {
    const photoUrl = resolveAssessmentMediaUrl(row.photo);
    const label = PDF_ACCESSORY_LABELS[row.key] || `${row.label}.`;
    const yesLabel = row.present === true ? 'Yes' : row.present === false ? 'No' : '—';

    if (row.present !== true) {
        return (
            <div className="flex items-center border-b border-black/20 py-2.5 text-[11pt] last:border-b-0">
                <span className="flex-1">{label}</span>
                <span className="w-24 text-center font-bold">{yesLabel}</span>
            </div>
        );
    }

    return (
        <div className="border-b border-black/20 py-3 text-[11pt] last:border-b-0">
            <div className="flex items-center">
                <span className="flex-1">{label}</span>
                <span className="w-24 text-center font-bold">Yes</span>
            </div>
            <p className="mt-2 text-[11pt]">
                If yes ({' '}
                <span className="vhf-pdf-link">Photo</span> Required mandatory)
            </p>
            <PdfPhotoBlock
                photoUrl={photoUrl}
                label={label}
                onPhotoClick={photoUrl && onPhotoClick ? () => onPhotoClick(row.key) : undefined}
            />
        </div>
    );
}

export function PdfAccessoriesList({ rows, onPhotoClick, className = '' }) {
    return (
        <div className={`border border-black px-4 py-1 ${className}`}>
            {rows.map((row) => (
                <PdfAccessoryRow key={row.key} row={row} onPhotoClick={onPhotoClick} />
            ))}
        </div>
    );
}

export function PdfBodyConditionCell({ view, onPhotoClick }) {
    const photoUrl = resolveAssessmentMediaUrl(view.photo);
    const label = PDF_BODY_CONDITION_LABELS[view.key] || view.label;

    return (
        <td className="w-1/2 border border-black p-2 align-top">
            <p className="text-[11pt] font-bold">
                {label}
            </p>
            <p className="mt-2 text-[11pt]">Comment</p>
            <p className="min-h-[24px] border-b border-black pb-1 text-[11pt]">
                {view.comment || ''}
            </p>
            <PdfPhotoBlock
                photoUrl={photoUrl}
                label={label}
                onPhotoClick={photoUrl && onPhotoClick ? () => onPhotoClick(view.key) : undefined}
            />
        </td>
    );
}
