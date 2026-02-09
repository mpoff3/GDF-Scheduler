"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AssignmentEditor } from "./assignment-editor";
import { MIN_TRAINING_WEEKS, MAX_TRAINING_WEEKS } from "@/lib/constants";
import { getMonday } from "@/lib/dates";
import type { ForecastData } from "@/queries/forecast";
import Link from "next/link";

function formatWeek(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function getDogBadgeClass(type: string, trainingWeeks: number) {
  if (type === "class") return "bg-green-100 text-green-800 border-green-300";
  if (type === "paused") return "bg-gray-100 text-gray-600 border-gray-300";
  // training
  if (trainingWeeks >= MAX_TRAINING_WEEKS) return "bg-red-100 text-red-800 border-red-300";
  if (trainingWeeks >= MIN_TRAINING_WEEKS) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-blue-100 text-blue-800 border-blue-300";
}

export function ForecastGrid({
  initialData,
  initialStartDate,
}: {
  initialData: ForecastData;
  initialStartDate: string;
}) {
  const [data, setData] = useState<ForecastData>(initialData);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    trainerId: number;
    trainerName: string;
    weekStart: string;
  } | null>(null);

  const weekCount = 12;

  const fetchData = useCallback(async (newStartDate: string) => {
    setLoading(true);
    try {
      const dateStr = newStartDate.split("T")[0];
      const res = await fetch(
        `/api/forecast?startDate=${dateStr}&weekCount=${weekCount}`
      );
      const newData = await res.json();
      setData(newData);
      setStartDate(newStartDate);
    } finally {
      setLoading(false);
    }
  }, []);

  function navigateWeeks(delta: number) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + delta * 7);
    fetchData(d.toISOString());
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigateWeeks(-12)}>
            &laquo; 12 weeks
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeeks(-4)}>
            &lsaquo; 4 weeks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchData(getMonday(new Date()).toISOString());
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeeks(4)}>
            4 weeks &rsaquo;
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateWeeks(12)}>
            12 weeks &raquo;
          </Button>
          <div className="ml-auto">
            <Button asChild size="sm">
              <Link href="/classes/new">Schedule Class</Link>
            </Button>
          </div>
        </div>

        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300" /> Training
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-200 border border-green-300" /> Class
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-200 border border-gray-300" /> Paused
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300" /> Ready (14+)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200 border border-red-300" /> Warning (18+)
          </span>
        </div>

        <div className="overflow-x-auto border border-gray-300 rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 min-w-[120px] border border-gray-300">
                  Trainer
                </th>
                {data.weekStarts.map((ws) => (
                  <th key={ws} className="text-center p-2 font-medium min-w-[120px] border border-gray-300">
                    {formatWeek(ws)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.trainers.map((row) => (
                <tr key={row.trainer.id}>
                  <td className="p-2 font-medium sticky left-0 bg-background border border-gray-300">
                    {row.trainer.name}
                  </td>
                  {data.weekStarts.map((ws) => {
                    const cell = row.weeks[ws];
                    return (
                      <td
                        key={ws}
                        className="p-1.5 cursor-pointer hover:bg-muted/30 align-top border border-gray-300 text-center"
                        onClick={() =>
                          setEditingCell({
                            trainerId: row.trainer.id,
                            trainerName: row.trainer.name,
                            weekStart: ws,
                          })
                        }
                      >
                        <div className="flex flex-col items-center gap-1">
                          {cell?.dogs.map((dog) => (
                            <Tooltip key={dog.id}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant="outline"
                                  className={`text-xs cursor-pointer shrink-0 ${getDogBadgeClass(dog.type, dog.trainingWeeks)}`}
                                >
                                  {dog.name}
                                  {dog.type === "training" && (
                                    <span className="ml-1 opacity-70">
                                      w{dog.trainingWeeks}
                                    </span>
                                  )}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{dog.name} - {dog.type}</p>
                                {dog.type === "training" && (
                                  <p>Training week {dog.trainingWeeks}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {data.trainers.length === 0 && (
                <tr>
                  <td
                    colSpan={data.weekStarts.length + 1}
                    className="text-center p-8 text-muted-foreground border border-gray-300"
                  >
                    No trainers yet. Add trainers to see the forecast.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {editingCell && (
          <AssignmentEditor
            trainerId={editingCell.trainerId}
            trainerName={editingCell.trainerName}
            weekStart={editingCell.weekStart}
            currentDogs={
              data.trainers
                .find((t) => t.trainer.id === editingCell.trainerId)
                ?.weeks[editingCell.weekStart]?.dogs || []
            }
            onClose={() => setEditingCell(null)}
            onSaved={() => {
              setEditingCell(null);
              fetchData(startDate);
            }}
          />
        )}

        {loading && (
          <div className="fixed inset-0 bg-black/10 flex items-center justify-center z-50">
            <div className="bg-background rounded-lg p-4 shadow-lg">
              Loading...
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
