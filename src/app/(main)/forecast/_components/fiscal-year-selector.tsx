"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FISCAL_YEAR_OPTIONS,
  type FiscalYearKey,
} from "@/lib/dates";

export function FiscalYearSelector({
  value,
  onValueChange,
}: {
  value: FiscalYearKey;
  onValueChange: (value: FiscalYearKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Fiscal Year</span>
      <Select
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue as FiscalYearKey)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Default" />
        </SelectTrigger>
        <SelectContent>
          {FISCAL_YEAR_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
