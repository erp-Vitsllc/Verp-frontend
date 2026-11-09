/** One payroll-month workbook. Columns match the PAYROLL {MONTH} sheet only. */

const COLUMNS = [
    { key: 'sl', header: 'SL No', width: 10, kind: 'sl' },
    { key: 'employeeId', header: 'Employee ID', width: 16, kind: 'text' },
    { key: 'name', header: 'Employee Name', width: 28, kind: 'text' },
    { key: 'company', header: 'Company', width: 16, kind: 'text' },
    { key: 'basic', header: 'Basic Salary', width: 15, kind: 'money', group: 'salary' },
    { key: 'otherAllowance', header: 'Other Allowance', width: 16, kind: 'money', group: 'salary' },
    { key: 'monthly', header: 'Monthly Salary', width: 16, kind: 'money', group: 'salary' },
    { key: 'presentDays', header: 'Present Days', width: 14, kind: 'days', group: 'attendance' },
    { key: 'lossOfPay', header: 'Loss of Pay', width: 14, kind: 'money', group: 'attendance' },
    { key: 'ot', header: 'OT Amount', width: 14, kind: 'money', group: 'extras' },
    { key: 'rewards', header: 'Rewards / Additions', width: 20, kind: 'money', group: 'extras' },
    { key: 'gross', header: 'Gross Salary', width: 15, kind: 'money', group: 'gross' },
    { key: 'fine', header: 'Fine', width: 12, kind: 'money', group: 'deductions' },
    { key: 'advance', header: 'Advance', width: 13, kind: 'money', group: 'deductions' },
    { key: 'loan', header: 'Loan', width: 12, kind: 'money', group: 'deductions' },
    { key: 'otherDeduction', header: 'Other Deductions', width: 18, kind: 'money', group: 'deductions' },
    { key: 'net', header: 'Net Salary', width: 15, kind: 'money', group: 'net' },
];

const GROUPS = [
    { title: 'Employee Data', from: 0, to: 3, fill: 'employee' },
    { title: 'Salary Data', from: 4, to: 6, fill: 'salary' },
    { title: 'Attendance', from: 7, to: 8, fill: 'attendance' },
    { title: 'Extras', from: 9, to: 10, fill: 'extras' },
    { title: '', from: 11, to: 11, fill: 'gross' },
    { title: 'Deductions', from: 12, to: 15, fill: 'deductions' },
    { title: '', from: 16, to: 16, fill: 'net' },
];

function money(value) {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function xmlText(value) {
    return String(value ?? '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function columnName(index) {
    let n = index + 1;
    let name = '';
    while (n > 0) {
        const rem = (n - 1) % 26;
        name = String.fromCharCode(65 + rem) + name;
        n = Math.floor((n - 1) / 26);
    }
    return name;
}

function sheetTitle(monthLabel) {
    const label = String(monthLabel || '').trim();
    const title = label && label !== '—' ? `PAYROLL ${label.toUpperCase()}` : 'PAYROLL';
    return title.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'PAYROLL';
}

function fileName(monthLabel, scopeLabel) {
    const month = String(monthLabel || 'Payroll').replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Payroll';
    const scope = String(scopeLabel || '').replace(/[<>:"/\\|?*]+/g, ' ').replace(/\s+/g, ' ').trim();
    return scope ? `Payroll ${month} - ${scope}.xlsx` : `Payroll ${month}.xlsx`;
}

function payrollLine(emp, index) {
    const basic = money(emp?.basicSalary);
    const monthly = money(emp?.monthlySalary);
    const other = emp?.otherAllowance != null
        ? money(emp.otherAllowance)
        : money(Math.max(0, monthly - basic));
    const present = emp?.sheetPresentDays != null ? Number(emp.sheetPresentDays) : Number(emp?.presentDays);
    const ot = money(emp?.ot ?? emp?.extra);
    const rewards = emp?.rewardAdditions != null
        ? money(emp.rewardAdditions)
        : money(Math.max(0, money(emp?.extra) - ot));
    const gross = emp?.zohoSalary != null
        ? money(emp.zohoSalary)
        : (emp?.grossSalary != null ? money(emp.grossSalary) : money(monthly + ot + rewards));
    const lossOfPay = emp?.sheetLossOfPay != null ? emp.sheetLossOfPay : emp?.lossOfPay;
    const split = emp?.fineAmount != null || emp?.sheetOtherDeduction != null;
    const company = String(emp?.companyName || '').trim();
    return {
        sl: index + 1,
        employeeId: String(emp?.employeeId || '').trim(),
        name: String(emp?.name || emp?.employeeId || '').trim(),
        company: !company || company === '—' ? 'Unassigned' : company,
        basic,
        otherAllowance: other,
        monthly,
        presentDays: Number.isFinite(present) ? present : 0,
        lossOfPay: money(lossOfPay),
        ot,
        rewards,
        gross,
        fine: split ? money(emp?.fineAmount) : 0,
        advance: split ? money(emp?.advanceAmount) : 0,
        loan: split ? money(emp?.loanAmount) : 0,
        otherDeduction: split ? money(emp?.sheetOtherDeduction) : money(emp?.otherDeduction),
        net: money(emp?.netSalaryPayable ?? emp?.actualSalary ?? emp?.monthlySalary),
    };
}

function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
        c ^= bytes[i];
        for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (c ^ 0xffffffff) >>> 0;
}

function dosStamp(date) {
    const d = date || new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const day = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, day };
}

function concatBytes(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function zipStore(files) {
    const encoder = new TextEncoder();
    const { time, day } = dosStamp(new Date());
    const locals = [];
    const central = [];
    let offset = 0;
    for (const file of files) {
        const name = encoder.encode(file.name);
        const data = encoder.encode(file.data);
        const crc = crc32(data);
        const local = new Uint8Array(30 + name.length);
        const view = new DataView(local.buffer);
        view.setUint32(0, 0x04034b50, true);
        view.setUint16(4, 20, true);
        view.setUint16(8, 0, true);
        view.setUint16(10, time, true);
        view.setUint16(12, day, true);
        view.setUint32(14, crc, true);
        view.setUint32(18, data.length, true);
        view.setUint32(22, data.length, true);
        view.setUint16(26, name.length, true);
        local.set(name, 30);
        locals.push(local, data);
        const cent = new Uint8Array(46 + name.length);
        const cv = new DataView(cent.buffer);
        cv.setUint32(0, 0x02014b50, true);
        cv.setUint16(4, 20, true);
        cv.setUint16(6, 20, true);
        cv.setUint16(10, 0, true);
        cv.setUint16(12, time, true);
        cv.setUint16(14, day, true);
        cv.setUint32(16, crc, true);
        cv.setUint32(20, data.length, true);
        cv.setUint32(24, data.length, true);
        cv.setUint16(28, name.length, true);
        cv.setUint32(42, offset, true);
        cent.set(name, 46);
        central.push(cent);
        offset += local.length + data.length;
    }
    const centralBytes = concatBytes(central);
    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, centralBytes.length, true);
    ev.setUint32(16, offset, true);
    return concatBytes([...locals, centralBytes, end]);
}

function stylesXml() {
    const fills = {
        employee: 'FFFFE15A',
        salary: 'FFFFF3C4',
        attendance: 'FFF4B183',
        extras: 'FFF8CBAD',
        gross: 'FF70AD47',
        deductions: 'FF7DCEA0',
        net: 'FFFFE15A',
        total: 'FFC6EFCE',
    };
    const fillXml = [
        '<fill><patternFill patternType="none"/></fill>',
        '<fill><patternFill patternType="gray125"/></fill>',
        ...Object.values(fills).map(
            (rgb) => `<fill><patternFill patternType="solid"><fgColor rgb="${rgb}"/></patternFill></fill>`,
        ),
    ];
    const fillId = { none: 0 };
    Object.keys(fills).forEach((key, index) => {
        fillId[key] = index + 2;
    });
    const fonts = [
        '<font><sz val="11"/><name val="Calibri"/></font>',
        '<font><b/><sz val="18"/><name val="Calibri"/><color rgb="FF111827"/></font>',
        '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FF1F2937"/></font>',
        '<font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',
        '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF1F2937"/></font>',
        '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF14532D"/></font>',
    ];
    const border = `<border>
      <left style="thin"><color rgb="FFD0D7E2"/></left>
      <right style="thin"><color rgb="FFD0D7E2"/></right>
      <top style="thin"><color rgb="FFD0D7E2"/></top>
      <bottom style="thin"><color rgb="FFD0D7E2"/></bottom>
    </border>`;
    function xf({ font = 0, fill = 0, borderId = 0, num = 0, align = 'center', wrap = false }) {
        return `<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="${align}" vertical="center"${wrap ? ' wrapText="1"' : ''}/></xf>`;
    }
    const cellXfs = [
        xf({}),
        xf({ font: 1, align: 'left' }),
    ];
    const groupStyle = {};
    const headStyle = {};
    for (const key of Object.keys(fills)) {
        if (key === 'total') continue;
        const light = key === 'gross';
        groupStyle[key] = cellXfs.length;
        cellXfs.push(xf({ font: light ? 3 : 2, fill: fillId[key], borderId: 1 }));
        headStyle[key] = cellXfs.length;
        cellXfs.push(xf({ font: light ? 3 : 4, fill: fillId[key], borderId: 1, wrap: true }));
    }
    const text = cellXfs.length;
    cellXfs.push(xf({ borderId: 1, align: 'left' }));
    const moneyStyle = cellXfs.length;
    cellXfs.push(xf({ borderId: 1, num: 4, align: 'right' }));
    const days = cellXfs.length;
    cellXfs.push(xf({ borderId: 1, num: 1, align: 'right' }));
    const sl = cellXfs.length;
    cellXfs.push(xf({ borderId: 1, num: 1, align: 'center' }));
    const totalText = cellXfs.length;
    cellXfs.push(xf({ font: 5, fill: fillId.total, borderId: 1, align: 'left' }));
    const totalMoney = cellXfs.length;
    cellXfs.push(xf({ font: 5, fill: fillId.total, borderId: 1, num: 4, align: 'right' }));
    const totalDays = cellXfs.length;
    cellXfs.push(xf({ font: 5, fill: fillId.total, borderId: 1, num: 1, align: 'right' }));
    return {
        xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="${fonts.length}">${fonts.join('')}</fonts>
  <fills count="${fillXml.length}">${fillXml.join('')}</fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>${border}</borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="${cellXfs.length}">${cellXfs.join('')}</cellXfs>
</styleSheet>`,
        style: {
            title: 1,
            group: groupStyle,
            head: headStyle,
            text,
            money: moneyStyle,
            days,
            sl,
            totalText,
            totalMoney,
            totalDays,
        },
    };
}

function inline(ref, style, value) {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${xmlText(value)}</t></is></c>`;
}

function numberCell(ref, style, value) {
    return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function formulaCell(ref, style, formula) {
    return `<c r="${ref}" s="${style}"><f>${formula}</f></c>`;
}

function headerFill(columnIndex) {
    if (columnIndex <= 3) return 'employee';
    if (columnIndex <= 6) return 'salary';
    if (columnIndex <= 8) return 'attendance';
    if (columnIndex <= 10) return 'extras';
    if (columnIndex === 11) return 'gross';
    if (columnIndex <= 15) return 'deductions';
    return 'net';
}

function dataStyle(kind, style) {
    if (kind === 'money') return style.money;
    if (kind === 'days') return style.days;
    if (kind === 'sl') return style.sl;
    return style.text;
}

function totalStyle(kind, style) {
    if (kind === 'money') return style.totalMoney;
    if (kind === 'days' || kind === 'sl') return style.totalDays;
    return style.totalText;
}

function worksheetXml(monthLabel, employees, style) {
    const title = sheetTitle(monthLabel);
    const lastCol = columnName(COLUMNS.length - 1);
    const lastData = 3 + employees.length;
    const totalRow = lastData + 1;
    const rows = [];
    const titleCells = [inline('A1', style.title, title)];
    for (let i = 1; i < COLUMNS.length; i += 1) titleCells.push(`<c r="${columnName(i)}1" s="${style.title}"/>`);
    rows.push(`<row r="1" ht="32" customHeight="1">${titleCells.join('')}</row>`);

    const groupCells = COLUMNS.map(() => '');
    const merges = [`<mergeCell ref="A1:${lastCol}1"/>`];
    for (const group of GROUPS) {
        const fill = group.fill;
        for (let i = group.from; i <= group.to; i += 1) {
            const ref = `${columnName(i)}2`;
            groupCells[i] = i === group.from && group.title
                ? inline(ref, style.group[fill], group.title)
                : `<c r="${ref}" s="${style.group[fill]}"/>`;
        }
        if (group.to > group.from) {
            merges.push(`<mergeCell ref="${columnName(group.from)}2:${columnName(group.to)}2"/>`);
        }
    }
    rows.push(`<row r="2" ht="24" customHeight="1">${groupCells.join('')}</row>`);

    const heads = COLUMNS.map((column, index) => {
        const fill = headerFill(index);
        return inline(`${columnName(index)}3`, style.head[fill], column.header);
    });
    rows.push(`<row r="3" ht="36" customHeight="1">${heads.join('')}</row>`);

    employees.forEach((emp, index) => {
        const line = payrollLine(emp, index);
        const cells = COLUMNS.map((column, colIndex) => {
            const ref = `${columnName(colIndex)}${index + 4}`;
            const cellStyle = dataStyle(column.kind, style);
            if (column.kind === 'text') return inline(ref, cellStyle, line[column.key]);
            return numberCell(ref, cellStyle, line[column.key]);
        });
        rows.push(`<row r="${index + 4}">${cells.join('')}</row>`);
    });

    const totals = COLUMNS.map((column, index) => {
        const ref = `${columnName(index)}${totalRow}`;
        const cellStyle = totalStyle(column.kind, style);
        if (column.kind === 'text' || column.kind === 'sl') {
            return index === 0 ? inline(ref, style.totalText, 'Total') : `<c r="${ref}" s="${style.totalText}"/>`;
        }
        const letter = columnName(index);
        return formulaCell(ref, cellStyle, `SUM(${letter}4:${letter}${lastData})`);
    });
    rows.push(`<row r="${totalRow}" ht="22" customHeight="1">${totals.join('')}</row>`);

    const cols = COLUMNS.map(
        (column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width}" customWidth="1"/>`,
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${totalRow}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${cols}</cols>
  <sheetData>${rows.join('')}</sheetData>
  <autoFilter ref="A3:${lastCol}${lastData}"/>
  <mergeCells count="${merges.length}">${merges.join('')}</mergeCells>
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
  <pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

export function buildPayrollWorkbookBytes({ monthLabel, employees }) {
    const people = [...(employees || [])].sort((a, b) =>
        String(a?.name || a?.employeeId || '').localeCompare(String(b?.name || b?.employeeId || ''), undefined, {
            sensitivity: 'base',
            numeric: true,
        }),
    );
    const styled = stylesXml();
    const name = sheetTitle(monthLabel);
    const files = [
        {
            name: '[Content_Types].xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
        },
        {
            name: '_rels/.rels',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
        },
        {
            name: 'xl/workbook.xml',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="${xmlText(name)}" sheetId="1" r:id="rId1"/></sheets>
  <calcPr calcMode="auto" fullCalcOnLoad="1"/>
</workbook>`,
        },
        {
            name: 'xl/_rels/workbook.xml.rels',
            data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
        },
        { name: 'xl/styles.xml', data: styled.xml },
        { name: 'xl/worksheets/sheet1.xml', data: worksheetXml(monthLabel, people, styled.style) },
    ];
    return zipStore(files);
}

export function downloadPayrollExcel({ monthLabel, scopeLabel, employees }) {
    const bytes = buildPayrollWorkbookBytes({ monthLabel, employees });
    const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName(monthLabel, scopeLabel);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
