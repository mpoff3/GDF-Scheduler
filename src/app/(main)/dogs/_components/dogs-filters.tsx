"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "in_training", label: "In Training" },
  { value: "ready_for_class", label: "Ready for Class" },
  { value: "in_class", label: "In Class" },
  { value: "graduated", label: "Graduated" },
  { value: "paused", label: "Paused" },
  { value: "not_yet_ift", label: "Not Yet IFT" },
  { value: "dropout", label: "Dropout" },
];

export function DogsFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const name = searchParams.get("name") ?? "";
  const status = searchParams.get("status") ?? "all";

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex gap-2 mb-4">
      <Input
        placeholder="Search by name…"
        value={name}
        onChange={(e) => updateParam("name", e.target.value)}
        className="max-w-xs"
      />
      <Select value={status} onValueChange={(val) => updateParam("status", val)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
