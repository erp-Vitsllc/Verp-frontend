'use client';

import { ImageIcon } from 'lucide-react';

/**
 * Photo panel for vehicle handover views.
 * Uses object-contain so the full image is visible without cropping.
 */
export default function VehicleHandoverAssessmentPhotoPanel({
    url,
    label,
    onClick,
    missing = false,
    sizeClass = 'w-full',
    borderClass = 'border-gray-300',
    emptyBorderClass = 'border-dashed border-gray-200',
    roundedClass = 'rounded-lg',
    heightClass = 'h-[100px]',
}) {
    const dimensionClass = heightClass || 'h-[100px]';
    const baseClass = `relative overflow-hidden border bg-gray-50 ${roundedClass} ${sizeClass} ${dimensionClass}`;

    if (!url) {
        return (
            <div
                className={`flex items-center justify-center ${baseClass} ${emptyBorderClass} ${
                    missing ? 'border-amber-300 text-amber-500' : 'text-gray-400'
                }`}
            >
                <ImageIcon size={22} strokeWidth={1.5} />
            </div>
        );
    }

    const Tag = onClick ? 'button' : 'div';

    return (
        <Tag
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={`${baseClass} ${borderClass} bg-white ${
                onClick ? 'transition-all hover:ring-2 hover:ring-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-500' : ''
            }`}
            title={onClick ? `View ${label} photo` : undefined}
        >
            <img
                src={url}
                alt={`${label} photo`}
                className="h-full w-full object-contain bg-gray-100"
            />
        </Tag>
    );
}
