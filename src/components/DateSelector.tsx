import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface DateSelectorProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
}

export function DateSelector({ date, onDateChange }: DateSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-medium h-12 border-border/60 bg-card hover:bg-card/80 hover:border-primary/30 transition-colors",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : <span>Pick planting date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          disabled={(date) => date < new Date('1900-01-01')}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
