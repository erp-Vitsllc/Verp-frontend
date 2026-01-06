'use client';

/**
 * Lazy Library Loaders
 * 
 * These functions load heavy libraries only when needed, reducing initial bundle size by ~650-1000 KB
 * Libraries are cached after first load to avoid reloading
 */

// Cache for loaded libraries
let countryStateCityCache = null;
let pdfjsLibCache = null;
let DatePickerCache = null;

/**
 * Lazy load country-state-city library
 * Only loads when address modals are opened
 * Size: ~150-200 KB
 */
export async function loadCountryStateCity() {
    if (countryStateCityCache) {
        return countryStateCityCache;
    }

    try {
        const { Country, State, City } = await import('country-state-city');
        countryStateCityCache = { Country, State, City };
        return countryStateCityCache;
    } catch (error) {
        console.error('Failed to load country-state-city:', error);
        throw error;
    }
}

/**
 * Lazy load PDF.js library
 * Only loads when document viewer opens for PDF files
 * Size: ~500-800 KB
 */
export async function loadPdfJs() {
    if (pdfjsLibCache) {
        return pdfjsLibCache;
    }

    try {
        const pdfjsLib = await import('pdfjs-dist');

        // Set worker if needed (for browser environment)
        if (typeof window !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        }

        pdfjsLibCache = pdfjsLib;
        return pdfjsLibCache;
    } catch (error) {
        console.error('Failed to load PDF.js:', error);
        throw error;
    }
}


/**
 * Lazy load react-datepicker library
 * Only loads when date picker is used
 * Size: ~60-80 KB
 */
export async function loadDatePicker() {
    if (DatePickerCache) {
        return DatePickerCache;
    }

    try {
        // Load CSS dynamically
        if (typeof window !== 'undefined') {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '/node_modules/react-datepicker/dist/react-datepicker.css';
            link.id = 'react-datepicker-css';

            // Check if already loaded
            if (!document.getElementById('react-datepicker-css')) {
                document.head.appendChild(link);
            }
        }

        const DatePicker = (await import('react-datepicker')).default;
        DatePickerCache = DatePicker;
        return DatePickerCache;
    } catch (error) {
        console.error('Failed to load react-datepicker:', error);
        throw error;
    }
}




