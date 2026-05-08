/** UAE emirate options for vehicle plate UI (add vehicle + list thumbnail). */

export const EMIRATES = [
    { value: 'Abu Dhabi', short: 'ABU DHABI', ar: 'ابوظبي' },
    { value: 'Dubai', short: 'DUBAI', ar: 'دبي' },
    { value: 'Sharjah', short: 'SHARJAH', ar: 'الشارقة' },
    { value: 'Ajman', short: 'AJMAN', ar: 'عجمان' },
    { value: 'Umm Al Quwain', short: 'UAQ', ar: 'ام القيوين' },
    { value: 'Ras Al Khaimah', short: 'RAK', ar: 'رأس الخيمة' },
    { value: 'Fujairah', short: 'FUJAIRAH', ar: 'الفجيرة' }
];

export const EMIRATE_PLATE_IMAGE = {
    'Abu Dhabi': '/assets/Abu_Dhabi_License_plate_-_Logo_-_520x110mm.png',
    Ajman: '/assets/Ajman_License_plate_-_520x110mm.png',
    Dubai: '/assets/Dubai_License_Plate_-_550x110mm.png',
    Fujairah: '/assets/Fujairah_License_Plate_-_550x110mm.png',
    'Umm Al Quwain': '/assets/Umm_Al_Quwain_Plate_-_550x110mm.png',
    'Ras Al Khaimah': '/assets/United_Arab_Emirates_Ras_Al_Khaimah_License_Plate_-_550x110mm.png',
    Sharjah: '/assets/United_Arab_Emirates_Sharjah_License_Plate_-_550x110mm.png'
};

/**
 * Split stored plate into letter code + digits for overlays (Add Vehicle + list thumbnail).
 * Handles: "A 2564", "A2564", "1 2564", "AA1 2564", "111111", odd spaces, hyphens.
 */
export function parsePlateParts(plateNumber) {
    const raw = String(plateNumber || '').trim().toUpperCase();
    if (!raw) return { code: '', digits: '' };

    const compact = raw
        .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, ' ')
        .replace(/[-_/]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Alphanumeric code then digits (space optional): supports numeric emirate codes too.
    let m = compact.match(/^([A-Z0-9]{1,3})\s*(\d{1,6})$/);
    if (m) return { code: m[1], digits: m[2] };

    // Digits only (no letter code)
    m = compact.match(/^(\d{1,6})$/);
    if (m) return { code: '', digits: m[1] };

    // Legacy variant with required space.
    m = compact.match(/^([A-Z0-9]{0,3})\s+(\d{1,6})$/);
    if (m) return { code: m[1] || '', digits: m[2] || '' };

    const digits = compact.replace(/\D/g, '').slice(0, 6);
    const code = compact.replace(/[^A-Z0-9]/g, '').slice(0, 3);
    return { code, digits };
}
