"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateTimePickerProps {
  date: Date | undefined
  setDate: (date: Date | undefined) => void
  minDate?: Date
  placeholder?: string
  className?: string
  error?: boolean
}

export function DateTimePicker({
  date,
  setDate,
  minDate,
  placeholder = "Pick a date and time",
  className,
  error,
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [hours, setHours] = React.useState<string>(
    date ? String(date.getHours()).padStart(2, "0") : "12"
  )
  const [minutes, setMinutes] = React.useState<string>(
    date ? String(date.getMinutes()).padStart(2, "0") : "00"
  )
  const [isOpen, setIsOpen] = React.useState(false)

  // Update internal state when date prop changes
  React.useEffect(() => {
    if (date) {
      setSelectedDate(date)
      setHours(String(date.getHours()).padStart(2, "0"))
      setMinutes(String(date.getMinutes()).padStart(2, "0"))
    }
  }, [date])

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const updatedDate = new Date(newDate)
      updatedDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
      setSelectedDate(updatedDate)
      setDate(updatedDate)
    } else {
      setSelectedDate(undefined)
      setDate(undefined)
    }
  }

  const handleTimeChange = (type: "hours" | "minutes", value: string) => {
    const numValue = parseInt(value, 10)
    
    if (type === "hours") {
      if (value === "" || (numValue >= 0 && numValue <= 23)) {
        setHours(value)
        if (selectedDate && value !== "") {
          const updatedDate = new Date(selectedDate)
          updatedDate.setHours(numValue, parseInt(minutes, 10), 0, 0)
          setDate(updatedDate)
        }
      }
    } else {
      if (value === "" || (numValue >= 0 && numValue <= 59)) {
        setMinutes(value)
        if (selectedDate && value !== "") {
          const updatedDate = new Date(selectedDate)
          updatedDate.setHours(parseInt(hours, 10), numValue, 0, 0)
          setDate(updatedDate)
        }
      }
    }
  }

  const handleHoursBlur = () => {
    if (hours === "") {
      setHours("00")
    } else {
      setHours(String(parseInt(hours, 10)).padStart(2, "0"))
    }
  }

  const handleMinutesBlur = () => {
    if (minutes === "") {
      setMinutes("00")
    } else {
      setMinutes(String(parseInt(minutes, 10)).padStart(2, "0"))
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full flex items-center justify-between bg-black/50 border rounded-xl px-4 py-3 text-left transition-colors",
            error
              ? "border-[#fffaf3]/50 focus:border-[#fffaf3]"
              : "border-[#fffaf3]/20 hover:border-[#fffaf3]/40 focus:border-[#fffaf3]/40",
            !date && "text-[#fffaf3]/30",
            className
          )}
        >
          <span className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-[#fffaf3]/50" />
            {date ? (
              <span className="text-[#fffaf3]">
                {format(date, "PPP")} at {format(date, "HH:mm")}
              </span>
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-black/95 border-[#fffaf3]/20" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(date) => minDate ? date < new Date(minDate.setHours(0, 0, 0, 0)) : date < new Date(new Date().setHours(0, 0, 0, 0))}
          initialFocus
        />
        <div className="border-t border-[#fffaf3]/10 p-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#fffaf3]/50" />
            <span className="text-sm text-[#fffaf3]/70">Time:</span>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                value={hours}
                onChange={(e) => handleTimeChange("hours", e.target.value)}
                onBlur={handleHoursBlur}
                className="w-12 bg-[#fffaf3]/10 border border-[#fffaf3]/20 rounded-md px-2 py-1 text-center text-[#fffaf3] text-sm focus:outline-none focus:border-[#fffaf3]/50"
                placeholder="HH"
                maxLength={2}
              />
              <span className="text-[#fffaf3]/50">:</span>
              <input
                type="text"
                value={minutes}
                onChange={(e) => handleTimeChange("minutes", e.target.value)}
                onBlur={handleMinutesBlur}
                className="w-12 bg-[#fffaf3]/10 border border-[#fffaf3]/20 rounded-md px-2 py-1 text-center text-[#fffaf3] text-sm focus:outline-none focus:border-[#fffaf3]/50"
                placeholder="MM"
                maxLength={2}
              />
            </div>
          </div>
        </div>
        <div className="border-t border-[#fffaf3]/10 p-3">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full py-2 rounded-lg bg-[#fffaf3] border border-[#fffaf3]/50 text-[#000] hover:bg-[#fffaf3]/90 transition-colors text-sm font-medium"
          >
            Done
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
