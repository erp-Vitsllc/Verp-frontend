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

export function DatePicker({ value, onChange, placeholder = "Pick a date", className, disabled }) {
    const [date, setDate] = React.useState(undefined)
    const [inputStr, setInputStr] = React.useState("")

    // Sync internal state with prop value (string YYYY-MM-DD -> Date)
    React.useEffect(() => {
        if (value) {
            const parsedDate = parse(value, 'yyyy-MM-dd', new Date())
            if (isValid(parsedDate)) {
                setDate(parsedDate)
                setInputStr(format(parsedDate, 'dd/MM/yyyy'))
            } else {
                // Fallback if formatting fails or empty
                setDate(undefined)
                setInputStr("")
            }
        } else {
            setDate(undefined)
            setInputStr("")
        }
    }, [value])

    const handleSelect = (selectedDate) => {
        setDate(selectedDate)
        if (selectedDate) {
            // Update parent with YYYY-MM-DD string
            onChange(format(selectedDate, 'yyyy-MM-dd'))
            setInputStr(format(selectedDate, 'dd/MM/yyyy'))
        } else {
            onChange('')
            setInputStr('')
        }
    }

    // Handle manual typing
    const handleInputChange = (e) => {
        const val = e.target.value
        setInputStr(val)

        // Try to parse dd/MM/yyyy
        if (val.length === 10) {
            const parsed = parse(val, 'dd/MM/yyyy', new Date())
            if (isValid(parsed)) {
                setDate(parsed)
                onChange(format(parsed, 'yyyy-MM-dd'))
            }
        } else if (val === '') {
            setDate(undefined)
            onChange('')
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
                        className
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
                        className="w-full px-2 py-1 text-sm border rounded"
                    />
                </div>
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={handleSelect}
                    captionLayout="dropdown"
                    fromYear={1900}
                    toYear={new Date().getFullYear() + 20}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
