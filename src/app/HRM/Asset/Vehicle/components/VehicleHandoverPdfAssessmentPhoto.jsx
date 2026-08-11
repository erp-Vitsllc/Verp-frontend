'use client';

import useAssessmentMediaUrl from '../hooks/useAssessmentMediaUrl';
import { hasStoredAssessmentPhoto } from '../utils/vehicleHandoverReceiverAssessment';
import VehicleHandoverAssessmentPhotoPanel from './VehicleHandoverAssessmentPhotoPanel';

/**
 * PDF preview/print photo slot.
 * History stores bare S3 keys — resolve via /storage/file (same as interactive assessment UI).
 * `data-pdf-assessment-photo` lets print/download wait until keys become blob URLs.
 */
export default function VehicleHandoverPdfAssessmentPhoto({
    photo,
    label,
    heightClass,
    sizeClass = 'w-full max-w-full',
}) {
    const hasPhoto = hasStoredAssessmentPhoto(photo);
    const { url, loading, failed } = useAssessmentMediaUrl(hasPhoto ? photo : null);

    const status = !hasPhoto
        ? 'empty'
        : loading && !url
            ? 'loading'
            : url
                ? 'ready'
                : failed
                    ? 'failed'
                    : 'empty';

    return (
        <div className="mt-1 leading-none" data-pdf-assessment-photo={status}>
            {url ? (
                <VehicleHandoverAssessmentPhotoPanel
                    url={url}
                    label={label}
                    sizeClass={sizeClass}
                    borderClass="border-0"
                    roundedClass="rounded-none"
                    heightClass={heightClass}
                />
            ) : (
                <div className={`w-full ${heightClass} bg-white`} aria-hidden="true" />
            )}
        </div>
    );
}
