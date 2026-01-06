'use client';

import React, { useState, useEffect } from 'react';
import PhoneInput, {
    isValidPhoneNumber,
    formatPhoneNumberIntl,
    parsePhoneNumber,
    getCountryCallingCode
} from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import en from 'react-phone-number-input/locale/en.json';

/**
 * Custom Country Select component that shows "ISO +CallingCode"
 */
const CustomCountrySelect = ({ value, onChange, labels = {}, iconComponent, unicodeFlags, ...rest }) => {
    // Helper to safely get calling code
    const getSafeCallingCode = (country) => {
        try {
            const countryCode = typeof country === 'string' ? country : country?.value;
            if (typeof countryCode === 'string' && countryCode.length === 2) {
                return getCountryCallingCode(countryCode);
            }
        } catch (e) {
            // Ignore errors
        }
        return '';
    };

    // Ensure value is a string-ready to avoid [object Object] errors
    const displayValue = typeof value === 'string' ? value : (value?.value || '');
    const callingCode = getSafeCallingCode(displayValue);

    return (
        <div className="country-select-container">
            <select
                {...rest}
                value={displayValue}
                onChange={event => onChange(event.target.value || undefined)}
                className="country-select-hidden"
            >
                <option value="">{String(labels?.ZZ || 'Select')}</option>
                {rest.options && rest.options.map((country) => {
                    const countryCode = typeof country === 'string' ? country : country?.value;
                    const countryLabel = typeof country === 'string' ? (labels[country] || country) : (country?.label || countryCode);

                    return (
                        <option key={typeof countryCode === 'string' ? countryCode : Math.random()} value={countryCode}>
                            {String(countryLabel)} {getSafeCallingCode(countryCode) ? `+${getSafeCallingCode(countryCode)}` : ''}
                        </option>
                    );
                })}
            </select>
            <div className="country-select-display flex items-center justify-center relative">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <span className="country-iso shrink-0">{String(displayValue || '??')}</span>
                    <span className="country-code text-gray-400">+{callingCode || '00'}</span>
                </div>
                <svg className="chevron-down absolute right-1.5" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
        </div>
    );
};

const PhoneInputField = ({
    value,
    onChange,
    label,
    error: externalError,
    className = "",
    placeholder = "Enter phone number",
    defaultCountry = "AE",
    required = false,
    disabled = false,
    ...props
}) => {
    const [internalError, setInternalError] = useState('');
    const [validatedNumber, setValidatedNumber] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(defaultCountry ? String(defaultCountry).toUpperCase() : "AE");

    // Fix E.164 console error by ensuring incoming value has '+'
    const safeValue = React.useMemo(() => {
        if (!value || typeof value !== 'string') return '';
        // Treat any numeric-only string as a potential E.164 that needs its '+' prefix
        if (/^\d+$/.test(value.trim()) && !value.trim().startsWith('+')) {
            return `+${value.trim()}`;
        }
        return value;
    }, [value]);

    const handleChange = (newValue) => {
        let val = newValue || '';

        // AUTO-DETECTION: If user types + in the phone box, jump it to country box
        if (typeof val === 'string' && val.startsWith('+')) {
            try {
                const phoneNumber = parsePhoneNumber(val);
                if (phoneNumber && phoneNumber.country && phoneNumber.country !== selectedCountry) {
                    setSelectedCountry(phoneNumber.country);
                }
            } catch (e) {
                // Not a full number yet
            }
        }

        // Ensure we pass international format to parent
        let internationalValue = val;
        try {
            if (val && !val.startsWith('+')) {
                const phoneNumber = parsePhoneNumber(val, selectedCountry);
                if (phoneNumber) {
                    internationalValue = phoneNumber.number;
                } else {
                    const dialCode = getCountryCallingCode(selectedCountry);
                    internationalValue = `+${dialCode}${val.replace(/\D/g, '')}`;
                }
            }
        } catch (e) {
            const dialCode = getCountryCallingCode(selectedCountry);
            internationalValue = `+${dialCode}${val.replace(/\D/g, '')}`;
        }

        const isValid = internationalValue ? isValidPhoneNumber(internationalValue) : !required;
        const formatted = internationalValue ? formatPhoneNumberIntl(internationalValue) : '';

        try {
            const phoneDetails = parsePhoneNumber(internationalValue);
            setValidatedNumber(phoneDetails ? phoneDetails.number.replace('+', '') : '');
        } catch (e) {
            setValidatedNumber('');
        }

        if (typeof onChange === 'function') {
            const phoneDetails = parsePhoneNumber(internationalValue);
            onChange(internationalValue, {
                isValid,
                formatted,
                countryCode: phoneDetails?.country || selectedCountry,
                dialCode: phoneDetails?.countryCallingCode || getCountryCallingCode(selectedCountry),
                name: phoneDetails?.country || selectedCountry
            });
        }
    };

    useEffect(() => {
        if (!value) {
            setInternalError(required ? 'Phone number is required' : '');
            setValidatedNumber('');
            return;
        }

        try {
            if (typeof value !== 'string') return;

            // Normalize for parsing: Ensure numeric-only values get a '+' for the parser
            const trimmedValue = value.trim();
            const normalizedValue = (trimmedValue.startsWith('+') || !/^\d+$/.test(trimmedValue))
                ? trimmedValue
                : `+${trimmedValue}`;

            const phoneNumber = parsePhoneNumber(normalizedValue);
            if (!phoneNumber) {
                setInternalError('Please enter a valid phone number');
                return;
            }

            if (phoneNumber.country && phoneNumber.country !== selectedCountry) {
                setSelectedCountry(phoneNumber.country);
            }

            if (!phoneNumber.isValid()) {
                const count = phoneNumber.nationalNumber.length;
                const country = phoneNumber.country;
                const cName = en[country] || 'this country';

                if (count > 10) {
                    setInternalError(`Phone number is too long for ${cName}`);
                } else {
                    setInternalError(`Phone number is too short for ${cName}`);
                }
            } else {
                setInternalError('');
            }

            setValidatedNumber(phoneNumber.number.replace('+', ''));
        } catch (e) {
            setInternalError('Please enter a valid phone number');
            setValidatedNumber('');
        }
    }, [value, required, selectedCountry]);

    const displayError = externalError || internalError;

    // Safety check for rendering label and error
    const renderLabel = typeof label === 'string' ? label : (label?.label || label || '');
    const renderError = typeof displayError === 'string' ? displayError : (displayError?.message || displayError?.error || '');

    return (
        <div className={`w-full ${className}`}>
            {renderLabel && (
                <label className="block text-sm font-medium text-gray-700 mb-2 font-semibold">
                    {String(renderLabel)} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            <div className="phone-wrapper-inner">
                <PhoneInput
                    international={false}
                    defaultCountry={selectedCountry}
                    value={safeValue}
                    onChange={handleChange}
                    onCountryChange={setSelectedCountry}
                    placeholder={placeholder}
                    countrySelectComponent={CustomCountrySelect}
                    labels={en}
                    disabled={disabled}
                    {...props}
                />
            </div>

            {renderError && (
                <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {String(renderError)}
                </p>
            )}

            {validatedNumber && !displayError && (
                <div className="mt-2 flex items-center gap-2 py-1.5 px-3 bg-green-50 border border-green-100 rounded-lg w-fit">
                    <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">Validated:</span>
                    <span className="text-sm font-bold text-green-900 tracking-tight">+{String(validatedNumber)}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-600">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            )}

            <style jsx global>{`
                .phone-wrapper-inner .PhoneInput {
                    display: flex !important;
                    align-items: center !important;
                    gap: 10px !important;
                    width: 100%;
                }
                .phone-wrapper-inner .PhoneInputCountry {
                    flex: 1 0 25% !important;
                    max-width: 25% !important;
                    min-width: 80px !important;
                }
                .country-select-container {
                    position: relative;
                    width: 100%;
                }
                .country-select-hidden {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: pointer;
                    z-index: 1;
                }
                .country-select-display {
                    background-color: #fff;
                    border: 1px solid #E5E7EB;
                    border-radius: 0.75rem;
                    padding: 0 0.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8125rem;
                    color: #111827;
                    height: 44px;
                    transition: border-color 0.2s;
                    overflow: hidden;
                    position: relative;
                }
                .country-select-display:hover {
                    border-color: #D1D5DB;
                }
                .country-iso {
                    font-weight: 700;
                    color: #1F2937;
                    font-family: monospace;
                    font-size: 0.8125rem;
                }
                .country-code {
                    font-weight: 500;
                    font-size: 0.75rem;
                    color: #6B7280;
                }
                .chevron-down {
                    color: #9CA3AF;
                    flex-shrink: 0;
                }
                .phone-wrapper-inner .PhoneInputInput {
                    flex: 3 0 75% !important;
                    max-width: calc(75% - 10px) !important;
                    min-width: 0 !important;
                    width: 100% !important;
                    background-color: #fff;
                    border: 1px solid ${displayError ? '#ef4444' : '#E5E7EB'} !important;
                    border-radius: 0.75rem !important;
                    padding: 0.625rem 0.875rem !important;
                    font-size: 0.9375rem !important;
                    font-weight: 500 !important;
                    outline: none !important;
                    transition: all 0.2s !important;
                    height: 44px !important;
                    color: #111827 !important;
                }
                .phone-wrapper-inner .PhoneInputInput:focus {
                    border-color: #3b82f6 !important;
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
                }
                .phone-wrapper-inner .PhoneInputInput::placeholder {
                    color: #9CA3AF;
                }
                /* Hide default library bits */
                .PhoneInputCountryIcon, .PhoneInputCountrySelectArrow {
                    display: none !important;
                }
            `}</style>
        </div>
    );
};

export default PhoneInputField;
