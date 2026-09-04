import React, { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

// Reliable birthdate picker: month/year dropdowns + day grid.
// Value is a 'YYYY-MM-DD' string; onChange receives the same format.
const BirthdatePicker = ({ value, onChange, testId = 'birthdate-picker' }) => {
  const [open, setOpen] = useState(false);

  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  const currentYear = new Date().getFullYear();

  const handleSelect = (date) => {
    if (date) {
      onChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !selected && 'text-muted-foreground'
          )}
          data-testid={`${testId}-trigger`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, 'MMMM d, yyyy') : <span>Pick birthdate</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" data-testid={`${testId}-popover`}>
        <Calendar
          mode="single"
          captionLayout="dropdown-buttons"
          fromYear={1900}
          toYear={currentYear}
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected || new Date(2000, 0)}
          disabled={{ after: new Date() }}
          classNames={{ caption_label: 'hidden' }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
};

export default BirthdatePicker;
