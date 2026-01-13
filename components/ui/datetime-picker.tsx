"use client"

import * as React from "react"
import { CalendarIcon, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  placeholder = "Select end date and time",
  className,
  error,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [hours, setHours] = React.useState<string>(
    date ? String(date.getHours()).padStart(2, "0") : "12"
  )
  const [minutes, setMinutes] = React.useState<string>(
    date ? String(date.getMinutes()).padStart(2, "0") : "00"
  )

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
      updatedDate.setHours(parseInt(hours, 10) || 0, parseInt(minutes, 10) || 0, 0, 0)
      setSelectedDate(updatedDate)
      setDate(updatedDate)
    } else {
      setSelectedDate(undefined)
      setDate(undefined)
    }
  }

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const numValue = parseInt(value, 10)

    if (value === "" || (numValue >= 0 && numValue <= 23)) {
      setHours(value)
      if (selectedDate && value !== "") {
        const updatedDate = new Date(selectedDate)
        updatedDate.setHours(numValue, parseInt(minutes, 10) || 0, 0, 0)
        setDate(updatedDate)
      }
    }
  }

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const numValue = parseInt(value, 10)

    if (value === "" || (numValue >= 0 && numValue <= 59)) {
      setMinutes(value)
      if (selectedDate && value !== "") {
        const updatedDate = new Date(selectedDate)
        updatedDate.setHours(parseInt(hours, 10) || 0, numValue, 0, 0)
        setDate(updatedDate)
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

  const formatDisplayDate = () => {
    if (!date) return placeholder
    return `${date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} at ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start font-normal bg-muted border rounded-xl px-4 py-6 text-left gap-2 hover:bg-muted/80",
            error
              ? "border-red-500 focus:border-red-500"
              : "border-border hover:border-primary focus:border-primary",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-50" />
          {formatDisplayDate()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
        {/* Calendar */}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDateSelect}
          disabled={(d) => minDate ? d < new Date(minDate.setHours(0, 0, 0, 0)) : d < new Date(new Date().setHours(0, 0, 0, 0))}
        />

        {/* Time Section */}
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Time:</span>
            <div className="flex items-center gap-1 ml-auto">
              <input
                type="text"
                value={hours}
                onChange={handleHoursChange}
                onBlur={handleHoursBlur}
                className="w-12 bg-muted border border-border rounded-lg px-3 py-2 text-center text-foreground text-sm font-medium focus:outline-none focus:border-primary"
                placeholder="HH"
                maxLength={2}
              />
              <span className="text-muted-foreground font-medium">:</span>
              <input
                type="text"
                value={minutes}
                onChange={handleMinutesChange}
                onBlur={handleMinutesBlur}
                className="w-12 bg-muted border border-border rounded-lg px-3 py-2 text-center text-foreground text-sm font-medium focus:outline-none focus:border-primary"
                placeholder="MM"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* Done Button */}
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
            className="w-full bg-foreground text-background hover:bg-foreground/90 font-medium"
          >
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
