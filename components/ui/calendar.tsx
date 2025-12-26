"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-[#fffaf3]",
        nav: "flex items-center gap-1",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "absolute left-1 h-7 w-7 bg-transparent border-[#fffaf3]/20 p-0 opacity-50 hover:opacity-100 hover:bg-[#fffaf3]/10"
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "absolute right-1 h-7 w-7 bg-transparent border-[#fffaf3]/20 p-0 opacity-50 hover:opacity-100 hover:bg-[#fffaf3]/10"
        ),
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-[#fffaf3]/50 rounded-md w-8 font-normal text-[0.8rem] text-center",
        week: "flex w-full mt-2",
        day: "relative p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 p-0 font-normal text-[#fffaf3] aria-selected:opacity-100 hover:bg-[#fffaf3]/10"
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected: "bg-[#fffaf3] text-[#000] hover:bg-[#fffaf3]/90 hover:text-[#000] focus:bg-[#fffaf3] focus:text-[#000] rounded-md",
        today: "bg-[#fffaf3]/10 text-[#fffaf3] rounded-md",
        outside: "text-[#fffaf3]/30 aria-selected:bg-[#fffaf3]/20 aria-selected:text-[#fffaf3]/50",
        disabled: "text-[#fffaf3]/20 opacity-50",
        range_middle: "aria-selected:bg-[#fffaf3]/20 aria-selected:text-[#fffaf3]",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className="h-4 w-4" />
          }
          return <ChevronRight className="h-4 w-4" />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
