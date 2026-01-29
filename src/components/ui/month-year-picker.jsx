"use client"

import * as React from "react"
import { format, parse, isValid, setMonth, setYear, addYears, subYears } from "date-fns"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function MonthYearPicker({ value, onChange, placeholder = "Pick a month", className, disabled }) {
    const [date, setDate] = React.useState(undefined)
    const [year, setYearState] = React.useState(new Date().getFullYear())
    const [isOpen, setIsOpen] = React.useState(false)

    React.useEffect(() => {
        if (value) {
            // value is expected to be yyyy-MM-dd or Date object
            const parsedDate = typeof value === 'string' ? parse(value, 'yyyy-MM-dd', new Date()) : value
            if (isValid(parsedDate)) {
                setDate(parsedDate)
                setYearState(parsedDate.getFullYear())
            } else {
                setDate(undefined)
            }
        } else {
            setDate(undefined)
        }
    }, [value])

    const handleMonthSelect = (monthIndex) => {
        const newDate = new Date(year, monthIndex, 1)
        setDate(newDate)
        onChange(format(newDate, 'yyyy-MM-dd'))
        setIsOpen(false)
    }

    const handleYearChange = (increment) => {
        setYearState(prev => prev + increment)
    }

    const goToCurrentMonth = () => {
        const now = new Date()
        const newDate = new Date(now.getFullYear(), now.getMonth(), 1)
        setYearState(now.getFullYear())
        setDate(newDate)
        onChange(format(newDate, 'yyyy-MM-dd'))
        setIsOpen(false)
    }

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ]

    // Generating a wider range of years (e.g., 20 years back and front)
    const yearOptions = Array.from({ length: 41 }, (_, i) => new Date().getFullYear() - 20 + i)

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal h-11 px-4 rounded-xl border-gray-200 hover:border-blue-500 hover:bg-blue-50/10 transition-all",
                        !date && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
                    {date ? (
                        <span className="font-medium text-gray-900">{format(date, "MMMM yyyy")}</span>
                    ) : (
                        <span>{placeholder}</span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
                {/* Header */}
                <div className="bg-gray-900 p-4 text-white">
                    <div className="flex items-center justify-between mb-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                            onClick={() => handleYearChange(-1)}
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <div className="relative group">
                            <select
                                value={year}
                                onChange={(e) => setYearState(parseInt(e.target.value))}
                                className="appearance-none bg-transparent font-bold text-lg focus:outline-none cursor-pointer pr-4 text-white text-center"
                            >
                                {yearOptions.map(y => (
                                    <option key={y} value={y} className="text-gray-900">{y}</option>
                                ))}
                            </select>
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 1L5 5L9 1" /></svg>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-white/10"
                            onClick={() => handleYearChange(1)}
                        >
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </div>
                    <p className="text-xs text-gray-400 text-center font-medium uppercase tracking-widest">Select Month</p>
                </div>

                {/* Grid */}
                <div className="p-4 bg-white">
                    <div className="grid grid-cols-3 gap-2 pb-4">
                        {months.map((month, index) => {
                            const isSelected = date && date.getMonth() === index && date.getFullYear() === year
                            return (
                                <Button
                                    key={month}
                                    variant="ghost"
                                    className={cn(
                                        "h-12 text-sm font-medium rounded-xl transition-all",
                                        isSelected
                                            ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200"
                                            : "hover:bg-blue-50 hover:text-blue-600 text-gray-600"
                                    )}
                                    onClick={() => handleMonthSelect(index)}
                                >
                                    {month}
                                </Button>
                            )
                        })}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex border-t border-gray-100 pt-3">
                        <Button
                            variant="ghost"
                            className="w-full text-xs font-bold text-blue-600 hover:bg-blue-50 uppercase tracking-wider h-10"
                            onClick={goToCurrentMonth}
                        >
                            Current Month
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}

