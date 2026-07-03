import {
    OIL_SERVICE_DETAIL_GRID_ACCENTS,
    OIL_SERVICE_DETAIL_GRID_LAYOUT,
} from './vehicleOilServiceDetailGrid';

export const ACCIDENT_REPAIR_DETAIL_GRID_LAYOUT = OIL_SERVICE_DETAIL_GRID_LAYOUT;
export const ACCIDENT_REPAIR_DETAIL_GRID_ACCENTS = OIL_SERVICE_DETAIL_GRID_ACCENTS;

export const tireFieldInput =
    'w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-900 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:text-gray-600 disabled:cursor-not-allowed';

export const tireFieldSelect = `${tireFieldInput} appearance-none`;
export const tireDatePickerClass = `${tireFieldInput} h-auto justify-start font-normal`;
export const tireMoneyInput = `${tireFieldInput} text-gray-900`;
export const tireSummaryValue = `${tireFieldInput} bg-gray-50 text-gray-800`;

export const tireUploadBtn =
    'inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-blue-600 hover:bg-blue-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const tireViewBtn =
    'inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs font-semibold text-blue-700 hover:bg-blue-100';

export const tireBtnSecondary =
    'min-w-[120px] rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40';

export const tireBtnPrimary =
    'min-w-[140px] rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40';

export const tireBtnBlue =
    'min-w-[140px] rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40';

export const tireBtnDanger =
    'min-w-[120px] rounded-lg border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-bold text-orange-800 hover:bg-orange-100 disabled:cursor-not-allowed disabled:opacity-40';

export const tirePhotoAddBtn =
    'w-14 h-14 shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors';

export const tirePhotoThumb =
    'w-14 h-14 shrink-0 rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm';

export function tireAccent(index) {
    return ACCIDENT_REPAIR_DETAIL_GRID_ACCENTS[index % ACCIDENT_REPAIR_DETAIL_GRID_ACCENTS.length];
}
