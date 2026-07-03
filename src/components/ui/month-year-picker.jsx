"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

const MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function parseMonthValue(value, valueFormat) {
    if (!value) return undefined
    const pattern = valueFormat === "yyyy-MM" ? "yyyy-MM" : "yyyy-MM-dd"
    const raw = valueFormat === "yyyy-MM" ? String(value).slice(0, 7) : String(value)
    const parsed = parse(raw, pattern, new Date())
    return isValid(parsed) ? parsed : undefined
}

function formatMonthValue(date, valueFormat) {
    return valueFormat === "yyyy-MM" ? format(date, "yyyy-MM") : format(date, "yyyy-MM-dd")
}

/**
 * Shadcn month grid picker.
 * @param {'yyyy-MM' | 'yyyy-MM-dd'} valueFormat - shape of `value` / `onChange` (default yyyy-MM-dd).
 */
export function MonthYearPicker({
    value,
    onChange,
    placeholder = "Pick a month",
    className,
    disabled,
    valueFormat = "yyyy-MM-dd",
    fromYear,
    toYear,
}) {
    const [date, setDate] = React.useState(undefined)
    const [year, setYearState] = React.useState(() => new Date().getFullYear())
    const [isOpen, setIsOpen] = React.useState(false)

    const minYear = fromYear ?? new Date().getFullYear() - 20
    const maxYear = toYear ?? new Date().getFullYear() + 10
    const yearOptions = React.useMemo(
        () => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i),
        [minYear, maxYear],
    )

    React.useEffect(() => {
        const parsed = parseMonthValue(value, valueFormat)
        if (parsed) {
            setDate(parsed)
            setYearState(parsed.getFullYear())
        } else {
            setDate(undefined)
        }
    }, [value, valueFormat])

    const applyMonth = React.useCallback(
        (monthIndex, nextYear = year) => {
            const newDate = new Date(nextYear, monthIndex, 1)
            setDate(newDate)
            setYearState(nextYear)
            onChange(formatMonthValue(newDate, valueFormat))
            setIsOpen(false)
        },
        [onChange, valueFormat, year],
    )

    const handleYearChange = (increment) => {
        setYearState((prev) => {
            const next = prev + increment
            if (next < minYear || next > maxYear) return prev
            return next
        })
    }

    const goToCurrentMonth = () => {
        const now = new Date()
        applyMonth(now.getMonth(), now.getFullYear())
    }

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal h-11 px-3.5 rounded-xl border-slate-200 bg-white hover:bg-white hover:border-slate-400",
                        !date && "text-muted-foreground",
                        className,
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-slate-500" />
                    {date ? (
                        <span className="font-medium text-slate-900">{format(date, "MMMM yyyy")}</span>
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-2xl border border-slate-200 shadow-xl overflow-hidden" align="start">
                <div className="bg-slate-900 p-4 text-white">
                    <div className="flex items-center justify-between mb-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                            onClick={() => handleYearChange(-1)}
                            disabled={year <= minYear}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="relative">
                            <select
                                value={year}
                                onChange={(e) => setYearState(parseInt(e.target.value, 10))}
                                className="appearance-none bg-transparent font-bold text-lg focus:outline-none cursor-pointer pr-5 text-white text-center min-w-[5rem]"
                                aria-label="Select year"
                            >
                                {yearOptions.map((y) => (
                                    <option key={y} value={y} className="text-slate-900">
                                        {y}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 pointer-events-none text-slate-400" />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
                            onClick={() => handleYearChange(1)}
                            disabled={year >= maxYear}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-[10px] text-slate-400 text-center font-semibold uppercase tracking-[0.2em]">
                        Select month
                    </p>
                </div>

                <div className="p-4 bg-white">
                    <div className="grid grid-cols-3 gap-2 pb-4">
                        {MONTH_LABELS.map((month, index) => {
                            const isSelected =
                                date && date.getMonth() === index && date.getFullYear() === year
                            return (
                                <Button
                                    key={month}
                                    type="button"
                                    variant="ghost"
                                    className={cn(
                                        "h-11 text-sm font-medium rounded-xl transition-all",
                                        isSelected
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200"
                                            : "hover:bg-blue-50 hover:text-blue-600 text-slate-600",
                                    )}
                                    onClick={() => applyMonth(index)}
                                >
                                    {month}
                                </Button>
                            )
                        })}
                    </div>

                    <div className="flex border-t border-slate-100 pt-3">
                        <Button
                            type="button"
                            variant="ghost"
                            className="w-full text-[11px] font-bold text-blue-600 hover:bg-blue-50 uppercase tracking-wider h-10"
                            onClick={goToCurrentMonth}
                        >
                            Current month
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

