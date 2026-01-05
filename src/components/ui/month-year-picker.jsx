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

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ]

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground",
                        className
                    )}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "MMM yyyy") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
                <div className="flex items-center justify-between mb-4">
                    <Button variant="ghost" size="icon" onClick={() => handleYearChange(-1)}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-semibold">{year}</div>
                    <Button variant="ghost" size="icon" onClick={() => handleYearChange(1)}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {months.map((month, index) => (
                        <Button
                            key={month}
                            variant={date && date.getMonth() === index && date.getFullYear() === year ? "default" : "ghost"}
                            className="h-9 px-2 text-sm"
                            onClick={() => handleMonthSelect(index)}
                        >
                            {month}
                        </Button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}
