import { useState } from 'react';
import { Search } from 'lucide-react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { CROP_DATABASE } from '@/lib/api';

const CROPS = Object.values(CROP_DATABASE)
  .map((c) => c.name)
  .sort();

interface CropSelectorProps {
  selectedCrop: string;
  onCropChange: (crop: string) => void;
}

export function CropSelector({ selectedCrop, onCropChange }: CropSelectorProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-12 border-border/60 bg-card hover:bg-card/80 hover:border-primary/30 text-left font-medium transition-colors"
        >
          {selectedCrop || "Select crop..."}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search crops..." className="h-12" />
          <CommandList>
            <CommandEmpty>No crop found.</CommandEmpty>
            <CommandGroup>
              {CROPS.map((crop) => (
                <CommandItem
                  key={crop}
                  value={crop}
                  onSelect={(currentValue) => {
                    onCropChange(currentValue === selectedCrop.toLowerCase() ? "" : crop);
                    setOpen(false);
                  }}
                  className={selectedCrop === crop ? "bg-accent/20 text-accent-foreground" : ""}
                >
                  {crop}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
