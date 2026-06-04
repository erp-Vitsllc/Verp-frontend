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

function isDateDisabled(checkDate, disabledDays) {
    if (!checkDate || !disabledDays) return false
    if (disabledDays instanceof Date) {
        return checkDate.getTime() === disabledDays.getTime()
    }
    if (disabledDays.after && checkDate > disabledDays.after) return true
    if (disabledDays.before && checkDate < disabledDays.before) return true
    return false
}

function mergeDateWithMonth(baseDate, monthDate) {
    const year = monthDate.getFullYear()
    const monthIndex = monthDate.getMonth()
    const maxDay = new Date(year, monthIndex + 1, 0).getDate()
    const day = Math.min(baseDate.getDate(), maxDay)
    return new Date(year, monthIndex, day)
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

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, disabled, disabledDays }) {
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

    React.useEffect(() => {
        if (value) {
            const parsedDate = parse(value, "yyyy-MM-dd", new Date())
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
        setMonth(nextMonth)
        if (date) {
            const adjusted = mergeDateWithMonth(date, nextMonth)
            if (adjusted.getTime() !== date.getTime()) {
                applyDate(adjusted)
            }
        }
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

    return (
        <Popover>
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
                    onSelect={handleSelect}
                    month={month}
                    onMonthChange={handleMonthChange}
                    captionLayout="dropdown"
                    fromYear={1900}
                    toYear={new Date().getFullYear() + 20}
                    initialFocus
                    disabled={disabledDays}
                />
            </PopoverContent>
        </Popover>
    )
}
