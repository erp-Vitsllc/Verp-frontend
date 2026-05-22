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

function parseYmd(value) {
    if (!value) return undefined
    const d = parse(value, "yyyy-MM-dd", new Date())
    return isValid(d) ? d : undefined
}

function rangeFromValues(startValue, endValue) {
    const from = parseYmd(startValue)
    const to = parseYmd(endValue)
    if (!from && !to) return undefined
    return { from, to }
}

function formatRangeLabel(from, to) {
    if (from && to) {
        return `${format(from, "MMM d, yyyy")} - ${format(to, "MMM d, yyyy")}`
    }
    if (from) return `${format(from, "MMM d, yyyy")} - …`
    if (to) return `… - ${format(to, "MMM d, yyyy")}`
    return null
}

/**
 * Dual-month date range picker (popover). Values are `yyyy-MM-dd` strings.
 * Selection is draft until OK; modal closes only on OK.
 */
export function DateRangePicker({
    startValue = "",
    endValue = "",
    onStartChange,
    onEndChange,
    placeholder = "Select date range",
    className,
    disabled,
    id,
}) {
    const [open, setOpen] = React.useState(false)
    const [draftRange, setDraftRange] = React.useState(undefined)

    const committedFrom = parseYmd(startValue)
    const committedTo = parseYmd(endValue)
    const label = formatRangeLabel(committedFrom, committedTo)

    const handleOpenChange = (nextOpen) => {
        if (nextOpen) {
            setDraftRange(rangeFromValues(startValue, endValue))
        } else {
            setDraftRange(rangeFromValues(startValue, endValue))
        }
        setOpen(nextOpen)
    }

    const handleOk = () => {
        onStartChange?.(draftRange?.from ? format(draftRange.from, "yyyy-MM-dd") : "")
        onEndChange?.(draftRange?.to ? format(draftRange.to, "yyyy-MM-dd") : "")
        setOpen(false)
    }

    const handleDraftClear = () => {
        setDraftRange(undefined)
    }

    return (
        <Popover open={open} onOpenChange={handleOpenChange}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className={cn(
                        "min-w-[16rem] max-w-full justify-start text-left font-normal border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50",
                        !label && "text-gray-400",
                        className,
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
                    <span className="truncate">{label || placeholder}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 border-gray-200 shadow-lg" align="start" sideOffset={6}>
                <div
                    className={cn(
                        "rounded-lg",
                        "[&_[data-range-start=true]]:bg-blue-600 [&_[data-range-start=true]]:text-white",
                        "[&_[data-range-end=true]]:bg-blue-600 [&_[data-range-end=true]]:text-white",
                        "[&_[data-range-middle=true]]:bg-blue-100 [&_[data-range-middle=true]]:text-blue-900",
                        "[&_[data-selected-single=true]]:bg-blue-600 [&_[data-selected-single=true]]:text-white",
                    )}
                >
                    <Calendar
                        mode="range"
                        numberOfMonths={2}
                        selected={draftRange}
                        onSelect={setDraftRange}
                        defaultMonth={draftRange?.from || draftRange?.to || committedFrom || committedTo || new Date()}
                        captionLayout="label"
                        showOutsideDays
                    />
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-3 py-2">
                    <button
                        type="button"
                        onClick={handleDraftClear}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={handleOk}
                        className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                        OK
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
