import { useEffect, useState } from 'react';
import { Country } from 'country-state-city';
import axiosInstance from '@/utils/axios';

export const DUBAI_TZ = 'Asia/Dubai';

const SHORT_CURRENCY = {
    AED: 'Dirham',
    INR: 'Rupees',
    PKR: 'Rupees',
    LKR: 'Rupees',
    NPR: 'Rupees',
    USD: 'US Dollar',
    EUR: 'Euro',
    GBP: 'Pound Sterling',
    BDT: 'Taka',
    PHP: 'Peso',
    SAR: 'Riyal',
    QAR: 'Riyal',
    OMR: 'Rial',
    KWD: 'Dinar',
    BHD: 'Dinar',
};

export function currencyShortName(code) {
    const currency = String(code || '').trim().toUpperCase();
    if (!currency) return '';
    if (SHORT_CURRENCY[currency]) return SHORT_CURRENCY[currency];
    try {
        return new Intl.DisplayNames(['en'], { type: 'currency' }).of(currency) || currency;
    } catch {
        return currency;
    }
}

export function workingFromOptions() {
    return Country.getAllCountries()
        .map((country) => ({
            value: country.isoCode,
            label: country.name,
            currency: String(country.currency || '').toUpperCase(),
            currencyName: currencyShortName(country.currency),
            timeZone: country.timezones?.[0]?.zoneName || '',
        }))
        .filter((country) => country.value && country.currency && country.timeZone)
        .sort((a, b) => a.label.localeCompare(b.label));
}

export function countryPay(isoCode) {
    return workingFromOptions().find((country) => country.value === String(isoCode || '').toUpperCase()) || null;
}

export const UAE_PAY = {
    workLocation: 'uae',
    workingFromCountry: 'United Arab Emirates',
    workingFromCountryCode: 'AE',
    salaryCurrency: 'AED',
    salaryCurrencyName: 'Dirham',
    workTimeZone: DUBAI_TZ,
};

export function zoneOffsetMinutes(timeZone, date = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hourCycle: 'h23',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).formatToParts(date);
        const pick = (type) => parts.find((part) => part.type === type)?.value;
        let hour = Number(pick('hour'));
        if (hour === 24) hour = 0;
        const asUtc = Date.UTC(
            Number(pick('year')),
            Number(pick('month')) - 1,
            Number(pick('day')),
            hour,
            Number(pick('minute')),
            Number(pick('second')),
        );
        return Math.round((asUtc - date.getTime()) / 60000);
    } catch {
        return null;
    }
}

export function clockShiftMinutes(timeZone, date = new Date()) {
    const zone = String(timeZone || '').trim();
    if (!zone || zone === DUBAI_TZ) return 0;
    const local = zoneOffsetMinutes(zone, date);
    const dubai = zoneOffsetMinutes(DUBAI_TZ, date);
    if (local == null || dubai == null) return 0;
    return local - dubai;
}

/** Scheduled employees outside UAE see the UAE shift in their own time zone. Flexible groups stay as stored. */
export function employeeClockShift(employee, timingMode, date = new Date()) {
    if (String(employee?.workLocation || '').toLowerCase() !== 'outside_uae') return 0;
    if (String(timingMode || '').toLowerCase() === 'flexible') return 0;
    return clockShiftMinutes(employee?.workTimeZone, date);
}

export function shiftClockLabel(value, minutes) {
    const delta = Number(minutes) || 0;
    const raw = String(value || '').trim();
    if (!delta || !raw || raw === '—') return raw;
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return raw;
    let total = Number(match[1]) * 60 + Number(match[2]) + delta;
    total = ((total % 1440) + 1440) % 1440;
    const hh = String(Math.floor(total / 60)).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return match[3] != null ? `${hh}:${mm}:${match[3]}` : `${hh}:${mm}`;
}

export function shiftMeridiemClock(hour, minute, meridiem, deltaMinutes) {
    let h = Number(hour);
    const m = Number(minute) || 0;
    const mer = String(meridiem || 'AM').toUpperCase();
    if (!Number.isFinite(h)) return '';
    if (mer === 'PM' && h !== 12) h += 12;
    if (mer === 'AM' && h === 12) h = 0;
    let total = h * 60 + m + (Number(deltaMinutes) || 0);
    total = ((total % 1440) + 1440) % 1440;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    const nextMer = hh >= 12 ? 'PM' : 'AM';
    let h12 = hh % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(mm).padStart(2, '0')} ${nextMer}`;
}

export function payCurrencyCode(employee) {
    if (String(employee?.workLocation || '').toLowerCase() !== 'outside_uae') return 'AED';
    return String(employee?.salaryCurrency || 'AED').trim().toUpperCase() || 'AED';
}

export function formatPayMoney(amount, currency = 'AED', rates, digits = 2) {
    const code = String(currency || 'AED').trim().toUpperCase() || 'AED';
    const number = Number(amount) || 0;
    const local = `${code} ${number.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
    if (code === 'AED') return local;
    const perAed = Number(rates?.[code]);
    if (!perAed) return local;
    const aed = number / perAed;
    const converted = aed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${local} (AED ${converted})`;
}

export function aedEquivalent(amount, currency, rates) {
    const code = String(currency || 'AED').trim().toUpperCase();
    if (!code || code === 'AED') return null;
    const perAed = Number(rates?.[code]);
    const number = Number(amount);
    if (!perAed || !Number.isFinite(number)) return null;
    return number / perAed;
}

let ratesCache = null;
let ratesPromise = null;

export function loadAedRates() {
    if (ratesCache) return Promise.resolve(ratesCache);
    if (!ratesPromise) {
        ratesPromise = axiosInstance
            .get('/Currency/rates', { skipToast: true })
            .then((response) => {
                ratesCache = response.data?.rates || null;
                return ratesCache;
            })
            .catch(() => null)
            .finally(() => {
                ratesPromise = null;
            });
    }
    return ratesPromise;
}

export function useAedRates() {
    const [rates, setRates] = useState(ratesCache);
    useEffect(() => {
        let active = true;
        loadAedRates().then((next) => {
            if (active && next) setRates(next);
        });
        return () => {
            active = false;
        };
    }, []);
    return rates;
}
