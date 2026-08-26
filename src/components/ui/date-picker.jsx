"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { MonthYearPicker } from "@/components/ui/month-year-picker"

function isDateDisabled(checkDate, disabledDays) {
    if (!checkDate || !disabledDays) return false
    if (disabledDays instanceof Date) {
        return checkDate.getTime() === disabledDays.getTime()
    }
    if (disabledDays.after && checkDate > disabledDays.after) return true
    if (disabledDays.before && checkDate < disabledDays.before) return true
    return false
}

/** Resolve day/month when user types dd/MM or MM/dd (e.g. 18/11 vs 11/18). */
function resolveDayMonth(part1, part2) {
    const first = Number(part1)
    const second = Number(part2)
    if (first > 12 && second >= 1 && second <= 12) {
        return { day: first, month: second }
    }
    if (second > 12 && first >= 1 && first <= 12) {
        return { day: second, month: first }
    }
    return { day: first, month: second }
}

function resolveYearFromPart(yearPart) {
    if (!yearPart || yearPart.length === 0) return new Date().getFullYear()
    if (yearPart.length < 4) {
        const partial = Number(yearPart)
        if (!Number.isFinite(partial)) return null
        if (yearPart.length <= 2) return 2000 + partial
        return partial
    }
    const year = Number(yearPart.slice(0, 4))
    return Number.isFinite(year) && year >= 1000 ? year : null
}

/**
 * Parse manual input and return calendar page + full date when complete.
 * Navigates month/year as soon as dd/mm[/yyyy] is recognizable.
 */
function parseFlexibleDateInput(value) {
    const trimmed = String(value || "").trim()
    const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{0,4}))?$/.exec(trimmed)
    if (!match) return { parsed: null, pageMonth: null }

    const { day, month } = resolveDayMonth(match[1], match[2])
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return { parsed: null, pageMonth: null }
    }

    const yearPart = match[3] ?? ""
    const year = resolveYearFromPart(yearPart)
    if (year === null) return { parsed: null, pageMonth: null }

    const pageMonth = new Date(year, month - 1, 1)

    if (yearPart.length < 4) {
        return { parsed: null, pageMonth }
    }

    const maxDay = new Date(year, month, 0).getDate()
    const safeDay = Math.min(day, maxDay)
    const parsed = new Date(year, month - 1, safeDay)
    if (!isValid(parsed)) return { parsed: null, pageMonth }

    return { parsed, pageMonth }
}

function parseValueToDate(value) {
    if (!value) return null
    const str = String(value).trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const parsed = parse(str, "yyyy-MM-dd", new Date())
        return isValid(parsed) ? parsed : null
    }
    const fromNative = new Date(str)
    if (!isValid(fromNative)) return null
    return new Date(fromNative.getFullYear(), fromNative.getMonth(), fromNative.getDate())
}

/**
 * @param {{ label: string, date?: string | Date | null, disabled?: boolean }} [quickAction]
 * Optional footer button inside the calendar (e.g. "Joining date", "Today").
 */
export function DatePicker({
    value,
    onChange,
    placeholder = "Pick a date",
    className,
    disabled,
    disabledDays,
    quickAction,
}) {
    const [open, setOpen] = React.useState(false)
    const [date, setDate] = React.useState(undefined)
    const [inputStr, setInputStr] = React.useState("")
    const [month, setMonth] = React.useState(() => new Date())

    const applyDate = React.useCallback(
        (nextDate, { notifyParent = true } = {}) => {
            if (!nextDate || !isValid(nextDate)) return false
            if (isDateDisabled(nextDate, disabledDays)) return false

            setDate(nextDate)
            setMonth(nextDate)
            setInputStr(format(nextDate, "dd/MM/yyyy"))
            if (notifyParent) {
                onChange(format(nextDate, "yyyy-MM-dd"))
            }
            return true
        },
        [disabledDays, onChange],
    )

    const handleQuickAction = React.useCallback(() => {
        const nextDate = parseValueToDate(quickAction?.date)
        if (!nextDate || quickAction?.disabled) return
        if (applyDate(nextDate)) {
            setOpen(false)
        }
    }, [applyDate, quickAction?.date, quickAction?.disabled])

    React.useEffect(() => {
        if (value) {
            const str = String(value).trim()
            let parsedDate
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                parsedDate = parse(str, "yyyy-MM-dd", new Date())
            } else {
                const fromNative = new Date(str)
                parsedDate = isValid(fromNative)
                    ? new Date(fromNative.getFullYear(), fromNative.getMonth(), fromNative.getDate())
                    : parse(str.slice(0, 10), "yyyy-MM-dd", new Date())
            }
            if (isValid(parsedDate)) {
                setDate(parsedDate)
                setInputStr(format(parsedDate, "dd/MM/yyyy"))
                setMonth(parsedDate)
            } else {
                setDate(undefined)
                setInputStr("")
            }
        } else {
            setDate(undefined)
            setInputStr("")
        }
    }, [value])

    const handleSelect = (selectedDate) => {
        if (!selectedDate) {
            setDate(undefined)
            setInputStr("")
            onChange("")
            return
        }
        applyDate(selectedDate)
    }

    const handleMonthChange = (nextMonth) => {
        // Only move the calendar view. Do not rewrite the selected issued date.
        setMonth(nextMonth)
    }

    const syncCalendarFromInput = React.useCallback((val) => {
        const { parsed, pageMonth } = parseFlexibleDateInput(val)
        if (pageMonth) {
            setMonth(pageMonth)
        }
        return parsed
    }, [])

    const handleInputChange = (e) => {
        const val = e.target.value
        setInputStr(val)

        if (val === "") {
            setDate(undefined)
            onChange("")
            return
        }

        const parsed = syncCalendarFromInput(val)
        const compactLen = val.replace(/\s/g, "").length
        if (parsed && compactLen >= 8) {
            if (!isDateDisabled(parsed, disabledDays)) {
                applyDate(parsed)
            }
        }
    }

    const handleInputBlur = () => {
        if (!inputStr) return
        const parsed = syncCalendarFromInput(inputStr)
        if (parsed && !isDateDisabled(parsed, disabledDays)) {
            applyDate(parsed)
        } else if (parsed) {
            setMonth(parsed)
        }
    }

    const quickActionEnabled =
        Boolean(quickAction?.label) &&
        !quickAction?.disabled &&
        Boolean(parseValueToDate(quickAction?.date)) &&
        !isDateDisabled(parseValueToDate(quickAction?.date), disabledDays)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                        className,
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b">
                    <input
                        type="text"
                        placeholder="dd/MM/yyyy"
                        value={inputStr}
                        onChange={handleInputChange}
                        onBlur={handleInputBlur}
                        className="w-full px-2 py-1 text-sm border rounded"
                    />
                </div>
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(selectedDate) => {
                        handleSelect(selectedDate)
                        if (selectedDate) setOpen(false)
                    }}
                    month={month}
                    onMonthChange={handleMonthChange}
                    captionLayout="dropdown"
                    fromYear={1900}
                    toYear={new Date().getFullYear() + 20}
                    initialFocus
                    disabled={disabledDays}
                />
                {quickAction?.label ? (
                    <div className="border-t p-2">
                        <button
                            type="button"
                            onClick={handleQuickAction}
                            disabled={!quickActionEnabled}
                            className="w-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
                        >
                            {quickAction.label}
                        </button>
                    </div>
                ) : null}
            </PopoverContent>
        </Popover>
    )
}

/** Month-only picker; `value` / `onChange` use `yyyy-MM` (e.g. 2026-07). */
export function MonthPicker({ value, onChange, placeholder = "Select month", className, disabled, disabledDays, fromYear, toYear }) {
    return (
        <MonthYearPicker
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={className}
            disabled={disabled}
            valueFormat="yyyy-MM"
            fromYear={fromYear ?? new Date().getFullYear() - 2}
            toYear={toYear ?? new Date().getFullYear() + 10}
        />
    )
}
