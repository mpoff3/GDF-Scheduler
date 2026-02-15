"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusColors: Record<string, string> = {
  in_training: "bg-blue-100 text-blue-800",
  ready_for_class: "bg-yellow-100 text-yellow-800",
  in_class: "bg-green-100 text-green-800",
  graduated: "bg-emerald-100 text-emerald-800",
  dropout: "bg-red-100 text-red-800",
  paused: "bg-gray-100 text-gray-600",
  not_yet_ift: "bg-amber-100 text-amber-800",
};

function formatIftDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function StatusBadge({
  status,
  recallWeekStartDate,
}: {
  status: string;
  recallWeekStartDate: Date | string | null;
}) {
  const label =
    status === "not_yet_ift" ? "Not Yet IFT" : status.replace(/_/g, " ");
  const showIftTooltip =
    status === "not_yet_ift" && recallWeekStartDate != null;
  const iftDateStr = recallWeekStartDate
    ? formatIftDate(
        typeof recallWeekStartDate === "string"
          ? recallWeekStartDate
          : recallWeekStartDate.toISOString()
      )
    : "";

  const badge = (
    <Badge
      className={statusColors[status] || ""}
      variant="outline"
    >
      {label}
    </Badge>
  );

  if (showIftTooltip) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            IFT: {iftDateStr}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
