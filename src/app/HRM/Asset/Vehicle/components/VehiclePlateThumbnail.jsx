'use client';

import { EMIRATE_PLATE_IMAGE, parsePlateParts } from '../lib/vehiclePlateConfig';

function resolvePlateEmirateForImage(plateEmirate) {
    const key = typeof plateEmirate === 'string' ? plateEmirate.trim() : '';
    if (key && EMIRATE_PLATE_IMAGE[key]) return key;
    // Legacy rows (or missing field): still show UAE plate artwork; Dubai matches the modal default.
    return 'Dubai';
}

/**
 * UAE plate graphic (same layout as Add Vehicle preview).
 * @param {'default'|'large'} size — `large` for vehicle details / hero-style display.
 */
export default function VehiclePlateThumbnail({ plateEmirate, plateNumber, className = '', size = 'default' }) {
    const { code, digits } = parsePlateParts(plateNumber);
    const emirate = resolvePlateEmirateForImage(plateEmirate);
    const imgSrc = EMIRATE_PLATE_IMAGE[emirate];
    const large = size === 'large';

    if (!plateNumber?.trim()) {
        return <span className="text-gray-400 text-sm">-</span>;
    }

    const showDigits = digits || '—';
    const hasCode = Boolean(code && code.trim());

    const maxW = large ? 'max-w-[min(100%,320px)]' : 'max-w-[168px]';
    const codeTextSize = large
        ? emirate === 'Dubai'
            ? 'text-[min(5.5vw,22px)]'
            : 'text-[min(6vw,24px)]'
        : emirate === 'Dubai'
          ? 'text-[12px]'
          : 'text-[13px]';
    const digitCls = large ? 'text-[min(6.5vw,28px)]' : 'text-[14px]';
    const shellRadius = large ? 'rounded-xl shadow-sm' : 'rounded-lg';

    return (
        <div
            className={`inline-block ${maxW} w-full ${shellRadius} overflow-hidden border border-gray-200 bg-white align-middle ${className}`}
            title={plateNumber}
        >
            <div className="relative w-full">
                <img
                    src={imgSrc}
                    alt=""
                    className="relative z-0 w-full h-auto block select-none pointer-events-none"
                    draggable={false}
                />
                {hasCode && (
                    <div
                        className={`absolute z-10 left-[6%] ${emirate === 'Dubai' ? 'top-[62%]' : 'top-1/2'} -translate-y-1/2 ${codeTextSize} font-black leading-none tracking-tight text-black [text-shadow:_0_0_1px_rgb(255_255_255),_0_0_3px_rgb(255_255_255)]`}
                    >
                        {code}
                    </div>
                )}
                <div
                    className={`absolute z-10 right-[10%] top-1/2 -translate-y-1/2 ${digitCls} font-black leading-none tracking-tight text-black [text-shadow:_0_0_1px_rgb(255_255_255),_0_0_3px_rgb(255_255_255)]`}
                >
                    {showDigits}
                </div>
            </div>
        </div>
    );
}
