'use client';

import Link from 'next/link';
import {
    buildEmployeeProfileHref,
    resolveEmployeeProfileKey,
} from '@/utils/employeeProfileHref';
import { navHrefProps } from '@/utils/linkContextMenu';

/**
 * Clickable employee name → profile. Renders plain text when no employee id is available
 * (e.g. company assignees). Drop-in for name spans — does not change assignment logic.
 * Right-click / Ctrl+click use the browser native new-tab menu (real <a>).
 */
export default function EmployeeNameLink({
    employee = null,
    employeeId = '',
    employeeObjectId = '',
    name = '',
    children = null,
    className = '',
    title,
    variant = 'default',
    stopPropagation = true,
    onClick,
    onContextMenu,
    ...rest
}) {
    const emp = employee && typeof employee === 'object' ? employee : null;
    const labelFromEmp = emp
        ? `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || String(emp.employeeId || '').trim()
        : '';
    const label = children ?? name ?? labelFromEmp ?? '—';
    const labelText = typeof label === 'string' ? label : name || labelFromEmp;

    const href = buildEmployeeProfileHref({
        employee: emp,
        employeeId,
        employeeObjectId,
        name: labelText,
        firstName: emp?.firstName,
        lastName: emp?.lastName,
    });

    const hasKey = Boolean(resolveEmployeeProfileKey({ employee: emp, employeeId, employeeObjectId }));
    const plain = !href || !hasKey || label === '—' || (typeof label === 'string' && !label.trim());

    if (plain) {
        return (
            <span className={className || undefined} title={title} {...rest}>
                {label}
            </span>
        );
    }

    const linkClass =
        variant === 'inherit'
            ? `hover:underline underline-offset-2 cursor-pointer ${className}`.trim()
            : `text-teal-700 hover:text-teal-800 hover:underline underline-offset-2 cursor-pointer ${className}`.trim();

    return (
        <Link
            href={href}
            className={linkClass}
            title={title || (labelText ? `Open ${labelText} profile` : 'Open employee profile')}
            onClick={(event) => {
                if (stopPropagation) event.stopPropagation();
                onClick?.(event);
            }}
            onContextMenu={(event) => {
                // Native browser menu — do not intercept.
                if (stopPropagation) event.stopPropagation();
                onContextMenu?.(event);
            }}
            {...navHrefProps(href)}
            {...rest}
        >
            {label}
        </Link>
    );
}

/**
 * Renders an assignment status line and hyperlinks only the employee name substring.
 * Company assignees and lines without an id stay plain text.
 */
export function EmployeeAssignmentStatusLine({
    asset,
    assigneeStr = '',
    line,
    className = '',
    linkClassName = '',
    variant = 'inherit',
}) {
    const text = String(line || '').trim();
    const namePart = String(assigneeStr || '').trim();
    const emp = asset?.assignedTo && typeof asset.assignedTo === 'object' ? asset.assignedTo : null;
    const companyAssigned = Boolean(asset?.assignedCompany);
    const canLink =
        Boolean(emp) &&
        !companyAssigned &&
        Boolean(namePart) &&
        Boolean(text) &&
        text.includes(namePart) &&
        Boolean(resolveEmployeeProfileKey({ employee: emp }));

    if (!canLink) {
        return <span className={className || undefined}>{text || '—'}</span>;
    }

    const idx = text.indexOf(namePart);
    const before = text.slice(0, idx);
    const after = text.slice(idx + namePart.length);

    return (
        <span className={className || undefined}>
            {before}
            <EmployeeNameLink
                employee={emp}
                name={namePart}
                variant={variant}
                className={linkClassName}
            />
            {after}
        </span>
    );
}
