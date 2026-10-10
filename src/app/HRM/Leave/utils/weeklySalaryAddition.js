/**
 * Weekly salary addition.
 * A report week is Monday–Saturday, clipped to the month. A month that starts
 * on Thursday begins Thursday–Saturday, and a month that ends mid-week stops
 * on that last day. Sunday is the week off. It stays out of the Monday–Saturday
 * label and is kept with the week it opens, so hours on that Sunday are still counted.
 *
 * Comp-off settlement stores the hours taken, not the overtime day they came
 * from. Those hours are paired with the earliest approved overtime in the month
 * so each week still adds up to the month.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WORKED_STATUS_KEYS = new Set(['on_office', 'work_from_home', 'late_arrived', 'early_go']);
const COMP_OFF_DAY_HOURS = 10;

function roundHours(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function money2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function shiftDateKey(dateKey, days) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    const next = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

function monthEndKey(monthKey) {
    const [year, month] = String(monthKey || '').split('-').map(Number);
    if (!year || !month) return '';
    return `${monthKey}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, '0')}`;
}

function eachDate(from, to) {
    const dates = [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return dates;
    let cursor = from;
    while (cursor <= to && dates.length < 40) {
        dates.push(cursor);
        cursor = shiftDateKey(cursor, 1);
    }
    return dates;
}

function weekdayIndex(dateKey) {
    return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function formatAdditionDay(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || ''))) return '—';
    const [year, month, day] = dateKey.split('-').map(Number);
    return `${String(day).padStart(2, '0')}-${MONTHS[month - 1]}-${year}`;
}

function hourPhrase(hours) {
    const total = roundHours(Math.abs(hours));
    return `${total} ${total === 1 ? 'Hour' : 'Hours'}`;
}

/** Same split as overtime approval: one working day becomes the next day, leftover hours stay as overtime. */
function splitNextDayHours(approvedHours, dayHours) {
    const approved = roundHours(approvedHours);
    let day = roundHours(dayHours);
    if (!(day > 0)) {
        if (!(approved > 10)) return { dayHours: 0, remainderHours: approved };
        day = 10;
    }
    if (approved + 1e-9 < day) return { dayHours: 0, remainderHours: approved };
    return {
        dayHours: day,
        remainderHours: Math.max(0, Math.floor(approved - day + 1e-9)),
    };
}

export function buildMonthWorkWeeks(monthKey) {
    const end = monthEndKey(monthKey);
    if (!end) return [];
    const weeks = [];
    let bucket = [];
    let opening = [];
    let carry = [];
    const flush = () => {
        if (!bucket.length) return;
        weeks.push({
            id: `${bucket[0]}_${bucket[bucket.length - 1]}`,
            index: weeks.length + 1,
            from: bucket[0],
            to: bucket[bucket.length - 1],
            dates: [...bucket],
            extraDates: [...opening],
        });
        bucket = [];
        opening = [];
    };
    eachDate(`${monthKey}-01`, end).forEach((date) => {
        if (weekdayIndex(date) === 0) {
            carry.push(date);
            return;
        }
        if (!bucket.length && carry.length) {
            opening = carry;
            carry = [];
        }
        bucket.push(date);
        if (weekdayIndex(date) === 6) flush();
    });
    flush();
    if (carry.length && weeks.length) weeks[weeks.length - 1].extraDates.push(...carry);
    return weeks;
}

/** The week before the one that contains today. On a Sunday, the week that just ended. */
export function defaultWorkWeekIndex(weeks, todayKey) {
    if (!weeks.length) return 0;
    const today = String(todayKey || '');
    const current = weeks.findIndex((week) => today >= week.from && today <= week.to);
    if (current > 0) return current - 1;
    if (current === 0) return 0;
    let previous = -1;
    weeks.forEach((week, index) => {
        if (week.to < today) previous = index;
    });
    return previous >= 0 ? previous : 0;
}

function blankDay(date) {
    return {
        date,
        statusKey: '',
        synthetic: false,
        fromDay: '',
        workedHours: 0,
        payable: 0,
        moved: 0,
        consumed: 0,
        incoming: 0,
        covered: false,
        coverSource: '',
        nextDayHours: 0,
        pendingFromSource: 0,
        compOffApproved: 0,
        compOffAdjusted: 0,
        otLinks: [],
        coverLinks: [],
        compOffLinks: [],
    };
}

function addLink(list, text) {
    const line = String(text || '').trim();
    if (!line || list.includes(line)) return;
    list.push(line);
}

function clockToMinutes(value) {
    const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function isSyntheticOtDay(row) {
    const inn = String(row?.timeIn || '').trim();
    const out = String(row?.timeOut || '').trim();
    return inn === 'OT' || out === 'OT' || Boolean(String(row?.flexibleFromOtDate || '').trim());
}

function measuredHours(row) {
    if (!row || isSyntheticOtDay(row)) return 0;
    const stored = Number(row.flexibleWorkedHours) || 0;
    if (stored > 0) return roundHours(stored);
    const start = clockToMinutes(row.timeIn);
    const end = clockToMinutes(row.timeOut);
    if (start == null || end == null) return 0;
    let diff = end - start;
    if (diff <= 0) diff += 24 * 60;
    return roundHours(diff / 60);
}

function preferRow(current, next) {
    if (!current) return next;
    const currentPunch = String(current.timeIn || '').trim();
    const nextPunch = String(next.timeIn || '').trim();
    if ((!currentPunch || currentPunch === 'OT') && nextPunch && nextPunch !== 'OT') return next;
    return current;
}

function emptyInfo() {
    return { required: false, scheduledHours: 0, weeklyOff: false, holiday: false };
}

function countsAsWorked(day) {
    if (!day) return false;
    if (day.covered) return true;
    if (day.synthetic) return Boolean(day.fromDay) || WORKED_STATUS_KEYS.has(day.statusKey);
    if (WORKED_STATUS_KEYS.has(day.statusKey)) return true;
    return day.workedHours > 0;
}

export function emptyWeeklySalaryAddition() {
    return {
        overtime: { approved: 0, adjusted: 0, balance: 0, title: '' },
        compOff: { approved: 0, adjusted: 0, balance: 0, title: '' },
        workingDay: { required: 0, worked: 0, balance: 0, title: '' },
        workingHours: { required: 0, worked: 0, balance: 0, title: '' },
        total: 0,
        details: [],
    };
}

export function buildWeeklySalaryAddition({
    monthKey,
    countTo = '',
    joinKey = '',
    records = [],
    daily = 0,
    flexible = false,
    weekDates = [],
    extraDates = [],
    dayInfo = () => emptyInfo(),
} = {}) {
    const month = String(monthKey || '');
    const weekSet = new Set([...(weekDates || []), ...(extraDates || [])]);
    if (!/^\d{4}-\d{2}$/.test(month) || !weekSet.size) return emptyWeeklySalaryAddition();

    const inCount = (date) => {
        if (!date.startsWith(month)) return false;
        if (joinKey && date < joinKey) return false;
        if (!countTo || date > countTo) return false;
        return true;
    };
    const infoOf = (date) => {
        const info = dayInfo(date) || emptyInfo();
        return {
            required: Boolean(info.required) && inCount(date),
            scheduledHours: Math.max(0, Number(info.scheduledHours) || 0),
            weeklyOff: Boolean(info.weeklyOff),
            holiday: Boolean(info.holiday),
        };
    };

    const byDate = new Map();
    (records || []).forEach((row) => {
        const date = String(row?.date || '').trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !inCount(date)) return;
        byDate.set(date, preferRow(byDate.get(date), row));
    });

    const ledger = new Map();
    const ensure = (date) => {
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
        if (!ledger.has(date)) ledger.set(date, blankDay(date));
        return ledger.get(date);
    };
    const overDayPay = new Set();
    const compOffs = [];

    const markOverDay = (target, source, hours) => {
        const payOn = target && String(target).startsWith(month) ? target : source;
        if (payOn) overDayPay.add(payOn);
        if (!target || !String(target).startsWith(month)) return;
        const covered = ensure(target);
        if (!covered) return;
        covered.covered = true;
        covered.coverSource = source;
        covered.incoming = roundHours(covered.incoming + hours);
        addLink(covered.coverLinks, `${formatAdditionDay(target)} adjusted with ${formatAdditionDay(source)}`);
    };

    byDate.forEach((row, date) => {
        const day = ensure(date);
        const status = String(row?.statusKey || '');
        const approved = String(row?.flexibleOtStatus || '') === 'approved' ? roundHours(row?.flexibleOtApprovedHours) : 0;
        const requiredField = Number(row?.flexibleRequiredHours) || 0;
        const nextDay = String(row?.flexibleOtNextDayDate || '').trim();
        const fromDay = String(row?.flexibleFromOtDate || '').trim();
        const synthetic = isSyntheticOtDay(row);
        const legacyDay = approved > 10 && !requiredField;
        day.statusKey = status;
        day.synthetic = synthetic;
        day.fromDay = fromDay;
        day.workedHours = measuredHours(row);

        if (status === 'compoff_leave') {
            const charge = String(row?.compOff?.chargeMonth || '').trim() || date.slice(0, 7);
            if (charge === month) {
                const state = String(row?.compOff?.state || '');
                const hours = state === 'adjusted'
                    ? (roundHours(row?.compOff?.otHoursDeducted) || COMP_OFF_DAY_HOURS)
                    : COMP_OFF_DAY_HOURS;
                day.compOffApproved = roundHours(day.compOffApproved + hours);
                if (state === 'adjusted' && hours > 0) {
                    compOffs.push({ date, hours, covered: 0, sources: [], day });
                }
            }
            return;
        }

        if (flexible) {
            if (nextDay && approved > 0) {
                const required = Number(row?.flexibleRequiredHours) || infoOf(date).scheduledHours || 0;
                const split = splitNextDayHours(approved, required);
                const coveredHours = split.dayHours > 0 ? split.dayHours : approved;
                const remain = split.dayHours > 0 ? split.remainderHours : 0;
                const line = remain > 0
                    ? `${formatAdditionDay(date)} adjusted with ${formatAdditionDay(nextDay)} (${hourPhrase(coveredHours)}). ${hourPhrase(remain)} remain as overtime`
                    : `${formatAdditionDay(date)} adjusted with ${formatAdditionDay(nextDay)}`;
                day.moved = roundHours(day.moved + coveredHours);
                day.nextDayHours = roundHours(day.nextDayHours + coveredHours);
                day.payable = roundHours(day.payable + remain);
                addLink(day.otLinks, line);
                addLink(day.compOffLinks, line);
                markOverDay(nextDay, date, coveredHours);
            } else if (fromDay && approved > 0) {
                day.pendingFromSource = roundHours(day.pendingFromSource + approved);
            } else if (legacyDay) {
                const line = `${formatAdditionDay(date)} approved overtime is converted to a day`;
                day.moved = roundHours(day.moved + approved);
                day.nextDayHours = roundHours(day.nextDayHours + approved);
                addLink(day.otLinks, line);
                addLink(day.compOffLinks, line);
                if (synthetic) markOverDay(date, date, approved);
            } else if (approved > 0) {
                day.payable = roundHours(day.payable + approved);
            }
            if (fromDay) {
                day.covered = true;
                day.coverSource = fromDay;
                addLink(day.coverLinks, `${formatAdditionDay(date)} adjusted with ${formatAdditionDay(fromDay)}`);
                if (date.startsWith(month)) overDayPay.add(date);
            }
            return;
        }

        const info = infoOf(date);
        if (day.workedHours > 0 && (info.holiday || info.weeklyOff)) {
            day.moved = roundHours(day.moved + day.workedHours);
            const where = info.holiday ? 'a holiday' : 'a weekly off';
            addLink(day.otLinks, `${formatAdditionDay(date)} worked on ${where} and counts as one day`);
            overDayPay.add(date);
            return;
        }
        if (info.required && day.workedHours > info.scheduledHours) {
            day.payable = roundHours(day.payable + Math.max(0, day.workedHours - info.scheduledHours));
        }
    });

    ledger.forEach((day) => {
        if (!(day.pendingFromSource > 0)) return;
        const source = day.coverSource ? ledger.get(day.coverSource) : null;
        if (source && source.nextDayHours > 0) return;
        day.payable = roundHours(day.payable + day.pendingFromSource);
    });

    const pool = [...ledger.values()]
        .filter((day) => day.payable > 0)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((day) => ({ day, left: day.payable }));
    compOffs.sort((a, b) => a.date.localeCompare(b.date));
    compOffs.forEach((comp) => {
        let need = comp.hours;
        pool.forEach((entry) => {
            if (!(need > 0) || !(entry.left > 0)) return;
            const used = roundHours(Math.min(entry.left, need));
            entry.left = roundHours(entry.left - used);
            entry.day.consumed = roundHours(entry.day.consumed + used);
            need = roundHours(need - used);
            comp.covered = roundHours(comp.covered + used);
            comp.sources.push({ date: entry.day.date, hours: used });
            addLink(
                entry.day.otLinks,
                `${formatAdditionDay(entry.day.date)} adjusted with comp off on ${formatAdditionDay(comp.date)} (${hourPhrase(used)})`,
            );
        });
        comp.day.compOffAdjusted = comp.covered;
        if (comp.sources.length) {
            const bits = comp.sources.map((source) => `${formatAdditionDay(source.date)} (${hourPhrase(source.hours)})`);
            const joined = bits.length === 1
                ? bits[0]
                : `${bits.slice(0, -1).join(', ')} and ${bits[bits.length - 1]}`;
            addLink(comp.day.compOffLinks, `${formatAdditionDay(comp.date)} adjusted from overtime on ${joined}`);
        }
    });

    ledger.forEach((day) => {
        if (!day.covered || day.incoming > 0) return;
        const scheduled = infoOf(day.date).scheduledHours;
        if (scheduled > 0) day.incoming = scheduled;
    });

    const titles = (days, key) => {
        const lines = [];
        days.forEach((day) => day[key].forEach((line) => addLink(lines, line)));
        return lines.join('\n');
    };
    const inWeek = (day) => weekSet.has(day.date);

    let otApproved = 0;
    let otAdjusted = 0;
    let otBalance = 0;
    let compApproved = 0;
    let compAdjusted = 0;
    let requiredDays = 0;
    let workedDays = 0;
    let requiredHours = 0;
    let workedHours = 0;
    const weekDays = [...ledger.values()].filter(inWeek);
    weekDays.forEach((day) => {
        otApproved = roundHours(otApproved + day.payable + day.moved);
        otAdjusted = roundHours(otAdjusted + day.moved + day.consumed);
        otBalance = roundHours(otBalance + Math.max(0, day.payable - day.consumed));
        let nextDayCompOff = day.nextDayHours;
        const source = day.coverSource ? ledger.get(day.coverSource) : null;
        const sourceOwnsCompOff = Boolean(source && source.nextDayHours > 0);
        if (!sourceOwnsCompOff && day.covered && day.incoming > 0 && !(day.nextDayHours > 0)) {
            nextDayCompOff = roundHours(nextDayCompOff + day.incoming);
            day.coverLinks.forEach((line) => addLink(day.compOffLinks, line));
        }
        compApproved = roundHours(compApproved + day.compOffApproved + nextDayCompOff);
        compAdjusted = roundHours(compAdjusted + day.compOffAdjusted + nextDayCompOff);
    });

    const coverTitles = [];
    weekSet.forEach((date) => {
        const info = infoOf(date);
        if (!info.required) return;
        requiredDays += 1;
        requiredHours = roundHours(requiredHours + info.scheduledHours);
        const day = ledger.get(date);
        const worked = countsAsWorked(day);
        if (worked) workedDays += 1;
        let credit = 0;
        if (day?.covered) credit = info.scheduledHours;
        else if ((day?.workedHours || 0) > 0) credit = Math.min(day.workedHours, info.scheduledHours);
        else if (worked && day?.statusKey !== 'early_go') credit = info.scheduledHours;
        workedHours = roundHours(workedHours + credit);
        if (day?.covered) day.coverLinks.forEach((line) => addLink(coverTitles, line));
    });

    const hourRate = (Number(daily) || 0) / 10;
    const detailDates = [...(weekDates || [])];
    (extraDates || []).forEach((date) => {
        if (!detailDates.includes(date)) detailDates.push(date);
    });
    detailDates.sort();
    const details = [];
    detailDates.forEach((date) => {
        const day = ledger.get(date) || blankDay(date);
        const inListedWeek = (weekDates || []).includes(date);
        const netHours = Math.max(0, roundHours(day.payable - day.consumed));
        const amount = money2((hourRate * netHours) + (overDayPay.has(date) ? Number(daily) || 0 : 0));
        const adjustedHours = roundHours(day.moved + day.consumed + day.compOffAdjusted + day.incoming);
        const active = amount !== 0 || adjustedHours > 0 || day.workedHours > 0 || day.compOffApproved > 0 || infoOf(date).required;
        if (!inListedWeek && !active) return;
        const linkLines = [];
        [...day.otLinks, ...day.coverLinks, ...day.compOffLinks].forEach((line) => addLink(linkLines, line));
        details.push({
            date,
            label: formatAdditionDay(date),
            workedHours: roundHours(day.workedHours),
            adjustedHours,
            title: linkLines.join('\n'),
            amount,
        });
    });

    const overDays = details.filter((row) => overDayPay.has(row.date)).length;
    const total = money2(details.reduce((sum, row) => sum + row.amount, 0));
    const balanceHours = roundHours(Math.max(0, otBalance));

    return {
        overtime: {
            approved: otApproved,
            adjusted: otAdjusted,
            balance: balanceHours,
            title: titles(weekDays, 'otLinks'),
        },
        compOff: {
            approved: compApproved,
            adjusted: compAdjusted,
            balance: roundHours(Math.max(0, compApproved - compAdjusted)),
            title: titles(weekDays, 'compOffLinks'),
        },
        workingDay: {
            required: requiredDays,
            worked: workedDays,
            balance: requiredDays - workedDays,
            title: coverTitles.join('\n'),
        },
        workingHours: {
            required: requiredHours,
            worked: workedHours,
            balance: roundHours(requiredHours - workedHours),
            title: coverTitles.join('\n'),
        },
        overDays,
        total,
        details,
    };
}
