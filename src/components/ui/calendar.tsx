import * as React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DateFormatter } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const formatCalendarCaption: DateFormatter = (month, options) => {
  const caption = format(month, "LLLL 'de' yyyy", { locale: options?.locale ?? ptBR });
  return caption.replace(/^./, (character) => character.toUpperCase());
};

function Calendar({ className, classNames, components, formatters, locale = ptBR, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      locale={locale}
      showOutsideDays={showOutsideDays}
      className={cn("w-full max-w-none p-0", className)}
      classNames={{
        months: "flex w-full flex-col",
        month: "min-w-0 w-full space-y-6",
        caption: "relative flex items-center justify-center px-12 pb-2 pt-1",
        caption_label: "text-[1.05rem] font-semibold tracking-tight",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-9 w-9 rounded-full border-border/70 bg-background/80 p-0 opacity-70 hover:opacity-100",
        ),
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full table-fixed border-collapse",
        head_row: "flex w-full gap-1.5",
        head_cell: "flex-1 pb-1 text-center text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground",
        row: "mt-1.5 flex w-full gap-1.5",
        cell: "relative flex-1 aspect-square min-h-[5.1rem] overflow-hidden p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "flex h-full w-full items-stretch rounded-[1rem] p-0 text-sm font-medium aria-selected:opacity-100",
        ),
        day_range_end: "day-range-end",
        day_selected:
          "rounded-[1rem] bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "rounded-[1rem] bg-accent text-accent-foreground",
        day_outside:
          "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      formatters={{
        formatCaption: formatCalendarCaption,
        ...formatters,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
