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

function monthFromInputFragment(value) {
    const match = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{1,4}))?$/.exec(String(value || "").trim())
    if (!match) return null
    const month = Number(match[2])
    const yearPart = match[3]
    if (month < 1 || month > 12) return null
    if (!yearPart || yearPart.length < 4) return null
    const year = Number(yearPart.slice(0, 4))
    if (!Number.isFinite(year) || year < 1000) return null
    const day = match[1] ? Math.min(Math.max(Number(match[1]) || 1, 1), 31) : 1
    return new Date(year, month - 1, day)
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

    const handleInputChange = (e) => {
        const val = e.target.value
        setInputStr(val)

        const pageMonth = monthFromInputFragment(val)
        if (pageMonth) {
            setMonth(pageMonth)
        }

        if (val.length === 10) {
            const parsed = parse(val, "dd/MM/yyyy", new Date())
            if (isValid(parsed)) {
                applyDate(parsed)
            }
        } else if (val === "") {
            setDate(undefined)
            onChange("")
        }
    }

    const handleInputBlur = () => {
        if (!inputStr) return
        const parsed = parse(inputStr, "dd/MM/yyyy", new Date())
        if (isValid(parsed)) {
            applyDate(parsed)
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
