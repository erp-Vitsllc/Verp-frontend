'use client';

import {
    CAR_DRIVEN_BY_COMPANY_PREFIX,
    CAR_DRIVEN_BY_EMPLOYEE_PREFIX,
    companyLabel,
    decodeCarDrivenByValue,
    encodeCarDrivenByValue,
    employeeLabel,
} from '../utils/vehicleCarDrivenBySelect';

export default function VehicleCarDrivenBySelect({
    formData,
    onChange,
    employees = [],
    companies = [],
    disabled = false,
    className = '',
    placeholder = 'Select',
}) {
    const value = encodeCarDrivenByValue(formData);

    return (
        <select
            className={className}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(decodeCarDrivenByValue(event.target.value))}
        >
            <option value="">{placeholder}</option>
            {employees.length > 0 ? (
                <optgroup label="Employees">
                    {employees.map((emp) => {
                        const id = String(emp?._id || emp?.id || '');
                        if (!id) return null;
                        return (
                            <option key={`emp-${id}`} value={`${CAR_DRIVEN_BY_EMPLOYEE_PREFIX}${id}`}>
                                {employeeLabel(emp)}
                            </option>
                        );
                    })}
                </optgroup>
            ) : null}
            {companies.length > 0 ? (
                <optgroup label="Companies">
                    {companies.map((comp) => {
                        const id = String(comp?._id || comp?.id || '');
                        if (!id) return null;
                        return (
                            <option key={`co-${id}`} value={`${CAR_DRIVEN_BY_COMPANY_PREFIX}${id}`}>
                                {companyLabel(comp)}
                            </option>
                        );
                    })}
                </optgroup>
            ) : null}
        </select>
    );
}
