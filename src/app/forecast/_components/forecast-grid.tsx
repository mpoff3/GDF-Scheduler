"use client";

import { useState, useCallback, useRef, useEffect, useLayoutEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssignmentEditor } from "./assignment-editor";
import { ParkingLotScheduler } from "./parking-lot-scheduler";
import { createAssignment, moveToParkingLot } from "@/actions/assignments";
import { MIN_TRAINING_WEEKS, MAX_TRAINING_WEEKS } from "@/lib/constants";
import { getMonday } from "@/lib/dates";
import type { ForecastData } from "@/queries/forecast";

const MAX_VISIBLE_DOGS = 10;
const LOAD_THRESHOLD_PX = 400;
const LOAD_CHUNK_WEEKS = 12;

function formatWeek(isoDate: string) {
  const d = new Date(isoDate);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function isRecallWeek(weekStart: string, recallWeekStarts: string[]) {
  return recallWeekStarts.some(
    (rws) => rws.split("T")[0] === weekStart.split("T")[0]
  );
}

function isClassWeek(weekStart: string, classWeekStarts: string[]) {
  return classWeekStarts.some(
    (cws) => cws.split("T")[0] === weekStart.split("T")[0]
  );
}

function getDogBadgeClass(type: string, trainingWeeks: number) {
  if (type === "class") return "bg-green-100 text-green-800 border-green-300";
  if (type === "paused") return "bg-gray-100 text-gray-600 border-gray-300";
  if (type === "graduated") return "bg-purple-100 text-purple-800 border-purple-300";
  if (type === "dropout") return "bg-rose-100 text-rose-800 border-rose-300";
  if (type === "not_yet_ift") return "bg-orange-100 text-orange-800 border-orange-300";
  // training: week 14 (cumulative completed 13) = blue; week 15+ (cumulative completed 14+) = yellow
  if (trainingWeeks >= MAX_TRAINING_WEEKS) return "bg-red-100 text-red-800 border-red-300";
  if (trainingWeeks > MIN_TRAINING_WEEKS) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-blue-100 text-blue-800 border-blue-300";
}

/** Merge two ForecastData objects when loading additional weeks */
function mergeForecastData(
  existing: ForecastData,
  incoming: ForecastData,
  direction: "left" | "right"
): ForecastData {
  const existingWeekSet = new Set(existing.weekStarts);
  const newWeeks = incoming.weekStarts.filter((w) => !existingWeekSet.has(w));

  const weekStarts =
    direction === "left"
      ? [...newWeeks, ...existing.weekStarts]
      : [...existing.weekStarts, ...newWeeks];

  // Merge trainer rows
  const trainers = existing.trainers.map((existingRow) => {
    const incomingRow = incoming.trainers.find(
      (t) => t.trainer.id === existingRow.trainer.id
    );
    return {
      trainer: existingRow.trainer,
      weeks: { ...existingRow.weeks, ...(incomingRow?.weeks || {}) },
    };
  });
  for (const incomingRow of incoming.trainers) {
    if (!trainers.some((t) => t.trainer.id === incomingRow.trainer.id)) {
      trainers.push(incomingRow);
    }
  }

  const mergeRow = (
    a: ForecastData["parkingLot"],
    b: ForecastData["parkingLot"]
  ) => ({
    trainer: a.trainer,
    weeks: { ...a.weeks, ...b.weeks },
  });

  const mergeArrays = (a: string[], b: string[]) =>
    Array.from(new Set([...a, ...b]));

  return {
    trainers,
    weekStarts,
    recallWeekStarts: mergeArrays(existing.recallWeekStarts, incoming.recallWeekStarts),
    recallCountByWeek: { ...existing.recallCountByWeek, ...incoming.recallCountByWeek },
    classWeekStarts: mergeArrays(existing.classWeekStarts, incoming.classWeekStarts),
    parkingLot: mergeRow(existing.parkingLot, incoming.parkingLot),
    notYetIft: mergeRow(existing.notYetIft, incoming.notYetIft),
    graduated: mergeRow(existing.graduated, incoming.graduated),
    droppedOut: mergeRow(existing.droppedOut, incoming.droppedOut),
  };
}

export function ForecastGrid({
  initialData,
}: {
  initialData: ForecastData;
}) {
  const [data, setData] = useState<ForecastData>(initialData);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    trainerId: number;
    trainerName: string;
    weekStart: string;
  } | null>(null);
  const [expandedCell, setExpandedCell] = useState<{
    label: string;
    weekStart: string;
    dogs: ForecastData["trainers"][number]["weeks"][string]["dogs"];
  } | null>(null);
  const [draggedDogId, setDraggedDogId] = useState<number | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const [schedulingDog, setSchedulingDog] = useState<{
    id: number;
    name: string;
    trainingWeeks: number;
    weekStart: string;
  } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadingLeftRef = useRef(false);
  const loadingRightRef = useRef(false);
  const prevScrollWidthRef = useRef(0);
  const isPrependingRef = useRef(false);
  const hasScrolledToTodayRef = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  const todayStr = getMonday(new Date()).toISOString().split("T")[0];

  // Scroll to today's column
  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const todayCol = container.querySelector(`[data-week-date="${todayStr}"]`) as HTMLElement;
    if (todayCol) {
      const containerRect = container.getBoundingClientRect();
      const colRect = todayCol.getBoundingClientRect();
      // Scroll so that today is ~140px from the left (past the sticky trainer column)
      container.scrollLeft += colRect.left - containerRect.left - 140;
    }
  }, [todayStr]);

  // Auto-scroll to today on mount
  useEffect(() => {
    if (!hasScrolledToTodayRef.current) {
      hasScrolledToTodayRef.current = true;
      requestAnimationFrame(() => scrollToToday());
    }
  }, [scrollToToday]);

  // Preserve scroll position after prepending weeks to the left
  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (container && isPrependingRef.current) {
      const diff = container.scrollWidth - prevScrollWidthRef.current;
      container.scrollLeft += diff;
      isPrependingRef.current = false;
    }
  });

  // Load more weeks in a direction
  const loadMoreWeeks = useCallback(async (direction: "left" | "right") => {
    if (direction === "left") {
      if (loadingLeftRef.current) return;
      loadingLeftRef.current = true;
    } else {
      if (loadingRightRef.current) return;
      loadingRightRef.current = true;
    }

    try {
      const currentData = dataRef.current;
      let dateStr: string;

      if (direction === "left") {
        const first = new Date(currentData.weekStarts[0]);
        first.setUTCDate(first.getUTCDate() - LOAD_CHUNK_WEEKS * 7);
        dateStr = getMonday(first).toISOString().split("T")[0];
        // Save scroll width before prepend so we can restore position
        if (scrollContainerRef.current) {
          prevScrollWidthRef.current = scrollContainerRef.current.scrollWidth;
          isPrependingRef.current = true;
        }
      } else {
        const last = new Date(currentData.weekStarts[currentData.weekStarts.length - 1]);
        last.setUTCDate(last.getUTCDate() + 7);
        dateStr = last.toISOString().split("T")[0];
      }

      const res = await fetch(
        `/api/forecast?startDate=${dateStr}&weekCount=${LOAD_CHUNK_WEEKS}`
      );
      const newData: ForecastData = await res.json();

      setData((prev) => {
        const merged = mergeForecastData(prev, newData, direction);
        dataRef.current = merged;
        return merged;
      });
    } finally {
      if (direction === "left") {
        loadingLeftRef.current = false;
      } else {
        loadingRightRef.current = false;
      }
    }
  }, []);

  // Handle scroll events — load more when near edges
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const { scrollLeft, scrollWidth, clientWidth } = container;
        const distanceFromRight = scrollWidth - scrollLeft - clientWidth;

        if (scrollLeft < LOAD_THRESHOLD_PX) {
          loadMoreWeeks("left");
        }
        if (distanceFromRight < LOAD_THRESHOLD_PX) {
          loadMoreWeeks("right");
        }
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [loadMoreWeeks]);

  // Refresh all currently loaded data (after assignments change)
  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const current = dataRef.current;
      const startDateStr = current.weekStarts[0].split("T")[0];
      const weekCount = current.weekStarts.length;
      const res = await fetch(
        `/api/forecast?startDate=${startDateStr}&weekCount=${weekCount}`
      );
      const newData = await res.json();
      setData(newData);
      dataRef.current = newData;
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleDrop(
    trainerId: number,
    weekStart: string,
    dogId: number,
    trainerHasClassThisWeek?: boolean
  ) {
    setDragOverCell(null);
    setDraggedDogId(null);
    setDropError(null);
    if (trainerHasClassThisWeek) {
      setDropError("Trainer is doing class this week; cannot assign a dog for training.");
      setTimeout(() => setDropError(null), 4000);
      return;
    }
    try {
      await createAssignment({
        dogId,
        trainerId,
        weekStartDate: weekStart.split("T")[0],
        type: "training",
      });
      refreshData();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : "Failed to assign dog");
      setTimeout(() => setDropError(null), 4000);
    }
  }

  async function handleDropParkingLot(weekStart: string, dogId: number) {
    setDragOverCell(null);
    setDraggedDogId(null);
    setDropError(null);
    try {
      await moveToParkingLot({
        dogId,
        weekStartDate: weekStart.split("T")[0],
      });
      refreshData();
    } catch (err) {
      setDropError(err instanceof Error ? err.message : "Failed to move to parking lot");
      setTimeout(() => setDropError(null), 4000);
    }
  }

  function renderDogBadges(
    dogs: ForecastData["trainers"][number]["weeks"][string]["dogs"],
    cellLabel: string,
    weekStart: string,
    onDogClick?: (dog: ForecastData["trainers"][number]["weeks"][string]["dogs"][number]) => void,
  ) {
    const sorted = [...dogs].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    );
    const visible = sorted.slice(0, MAX_VISIBLE_DOGS);
    const remaining = sorted.length - MAX_VISIBLE_DOGS;

    return (
      <div className="flex flex-col items-center gap-1">
        {visible.map((dog) => (
          <Tooltip key={dog.id}>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/dog-id", String(dog.id));
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedDogId(dog.id);
                }}
                onDragEnd={() => {
                  setDraggedDogId(null);
                  setDragOverCell(null);
                }}
                onClick={onDogClick ? (e) => {
                  e.stopPropagation();
                  onDogClick(dog);
                } : undefined}
                className={`text-xs cursor-grab active:cursor-grabbing shrink-0 ${getDogBadgeClass(dog.type, dog.trainingWeeks)} ${draggedDogId === dog.id ? "opacity-50" : ""} ${onDogClick ? "hover:ring-2 hover:ring-blue-400 cursor-pointer" : ""}`}
              >
                {dog.name}
                <span className="ml-1 opacity-70">
                  w{dog.trainingWeeks}
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Completed {dog.trainingWeeks} weeks of training so far</p>
              {onDogClick && <p className="text-xs opacity-70">Click to schedule</p>}
            </TooltipContent>
          </Tooltip>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium mt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedCell({ label: cellLabel, weekStart, dogs: sorted });
            }}
          >
            +{remaining} more…
          </button>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={scrollToToday}
          >
            Today
          </Button>
          <span className="text-sm text-muted-foreground">
            Scroll left and right to navigate weeks
          </span>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-blue-200 border border-blue-300" /> Training
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-200 border border-green-300" /> Class
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-300" /> Training but Ready
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200 border border-red-300" /> Warning (18+)
          </span>
        </div>

        <div
          ref={scrollContainerRef}
          className="overflow-x-auto border border-gray-300 rounded-lg"
        >
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 font-medium sticky left-0 bg-muted min-w-[120px] border border-gray-300 z-10">
                  Trainer
                </th>
                {data.weekStarts.map((ws) => {
                  const recall = isRecallWeek(ws, data.recallWeekStarts ?? []);
                  const classWeek = isClassWeek(ws, data.classWeekStarts ?? []);
                  const isToday = ws.split("T")[0] === todayStr;
                  return (
                    <th
                      key={ws}
                      data-week-date={ws.split("T")[0]}
                      className={`text-center p-2 font-medium min-w-[120px] border border-gray-300 ${
                        classWeek ? "bg-green-50/80 border-green-200" : ""
                      } ${recall && !classWeek ? "bg-amber-50/80 border-amber-200" : ""} ${
                        recall && classWeek ? "border-amber-200" : ""
                      } ${isToday ? "border-t-[3px] border-t-blue-500" : ""}`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {isToday && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600">
                            Today
                          </span>
                        )}
                        <span>{formatWeek(ws)}</span>
                        <div className="flex flex-wrap justify-center gap-0.5">
                          {classWeek && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-green-700 bg-green-100/90 px-1.5 py-0.5 rounded">
                              Class
                            </span>
                          )}
                          {recall && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded">
                              Recall ({data.recallCountByWeek?.[ws] ?? 0})
                            </span>
                          )}
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {data.trainers.map((row) => (
                <tr key={row.trainer.id}>
                  <td className="p-2 font-medium sticky left-0 bg-background border border-gray-300 z-10">
                    {row.trainer.name}
                  </td>
                  {data.weekStarts.map((ws) => {
                    const cell = row.weeks[ws];
                    const recall = isRecallWeek(ws, data.recallWeekStarts ?? []);
                    const classWeek = isClassWeek(ws, data.classWeekStarts ?? []);
                    const isToday = ws.split("T")[0] === todayStr;
                    return (
                      <td
                        key={ws}
                        className={`p-1.5 cursor-pointer hover:bg-muted/30 align-top border border-gray-300 text-center transition-colors ${
                          recall && !classWeek ? "bg-amber-50/50 border-amber-200/70 " : ""
                        }${
                          isToday ? "bg-blue-50/30 " : ""
                        }${
                          dragOverCell === `${row.trainer.id}:${ws}`
                            ? "!bg-blue-100 ring-2 ring-inset ring-blue-400"
                            : draggedDogId != null
                            ? "bg-blue-50/30"
                            : ""
                        }`}
                        onClick={() =>
                          setEditingCell({
                            trainerId: row.trainer.id,
                            trainerName: row.trainer.name,
                            weekStart: ws,
                          })
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          const cellKey = `${row.trainer.id}:${ws}`;
                          if (dragOverCell !== cellKey) setDragOverCell(cellKey);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverCell(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dogId = Number(e.dataTransfer.getData("application/dog-id"));
                          const trainerHasClassThisWeek = cell?.dogs?.some((d) => d.type === "class");
                          if (dogId) handleDrop(row.trainer.id, ws, dogId, trainerHasClassThisWeek);
                        }}
                      >
                        {cell?.dogs && renderDogBadges(cell.dogs, row.trainer.name, ws)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {data.parkingLot && (
                <tr className="bg-muted/30">
                  <td className="p-2 font-medium sticky left-0 bg-muted border border-gray-300 z-10">
                    {data.parkingLot.trainer.name}
                  </td>
                  {data.weekStarts.map((ws) => {
                    const cell = data.parkingLot.weeks[ws];
                    const recall = isRecallWeek(ws, data.recallWeekStarts ?? []);
                    const classWeek = isClassWeek(ws, data.classWeekStarts ?? []);
                    return (
                      <td
                        key={ws}
                        className={`p-1.5 align-top border border-gray-300 text-center transition-colors ${recall && !classWeek ? "bg-amber-50/50 border-amber-200/70" : ""} ${
                          dragOverCell === `parking:${ws}`
                            ? "!bg-gray-200 ring-2 ring-inset ring-gray-400"
                            : draggedDogId != null
                            ? "bg-gray-100/40"
                            : ""
                        }`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          const cellKey = `parking:${ws}`;
                          if (dragOverCell !== cellKey) setDragOverCell(cellKey);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                            setDragOverCell(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dogId = Number(e.dataTransfer.getData("application/dog-id"));
                          if (dogId) handleDropParkingLot(ws, dogId);
                        }}
                      >
                        {cell?.dogs && renderDogBadges(cell.dogs, data.parkingLot.trainer.name, ws, (dog) => {
                          setSchedulingDog({
                            id: dog.id,
                            name: dog.name,
                            trainingWeeks: dog.trainingWeeks,
                            weekStart: ws,
                          });
                        })}
                      </td>
                    );
                  })}
                </tr>
              )}
              {/* Not Yet IFT row */}
              {data.notYetIft && (
                <tr className="bg-orange-50/50">
                  <td className="p-2 font-medium sticky left-0 bg-orange-50 border border-gray-300 z-10">
                    Not Yet IFT
                  </td>
                  {data.weekStarts.map((ws) => {
                    const cell = data.notYetIft.weeks[ws];
                    const recall = isRecallWeek(ws, data.recallWeekStarts ?? []);
                    const classWeek = isClassWeek(ws, data.classWeekStarts ?? []);
                    return (
                      <td
                        key={ws}
                        className={`p-1.5 align-top border border-gray-300 text-center ${recall && !classWeek ? "bg-amber-50/50 border-amber-200/70" : ""}`}
                      >
                        {cell?.dogs && renderDogBadges(cell.dogs, "Not Yet IFT", ws)}
                      </td>
                    );
                  })}
                </tr>
              )}
              {/* Graduated row */}
              {data.graduated && (
                <tr className="bg-purple-50/50">
                  <td className="p-2 font-medium sticky left-0 bg-purple-50 border border-gray-300 z-10">
                    Graduated
                  </td>
                  {data.weekStarts.map((ws) => {
                    const cell = data.graduated.weeks[ws];
                    const recall = isRecallWeek(ws, data.recallWeekStarts ?? []);
                    const classWeek = isClassWeek(ws, data.classWeekStarts ?? []);
                    return (
                      <td
                        key={ws}
                        className={`p-1.5 align-top border border-gray-300 text-center ${recall && !classWeek ? "bg-amber-50/50 border-amber-200/70" : ""}`}
                      >
                        {cell?.dogs && renderDogBadges(cell.dogs, "Graduated", ws)}
                      </td>
                    );
                  })}
                </tr>
              )}
              {/* Dropped Out row */}
              {data.droppedOut && (
                <tr className="bg-rose-50/50">
                  <td className="p-2 font-medium sticky left-0 bg-rose-50 border border-gray-300 z-10">
                    Dropped Out
                  </td>
                  {data.weekStarts.map((ws) => {
                    const cell = data.droppedOut.weeks[ws];
                    const recall = isRecallWeek(ws, data.recallWeekStarts ?? []);
                    const classWeek = isClassWeek(ws, data.classWeekStarts ?? []);
                    return (
                      <td
                        key={ws}
                        className={`p-1.5 align-top border border-gray-300 text-center ${recall && !classWeek ? "bg-amber-50/50 border-amber-200/70" : ""}`}
                      >
                        {cell?.dogs && renderDogBadges(cell.dogs, "Dropped Out", ws)}
                      </td>
                    );
                  })}
                </tr>
              )}
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
              refreshData();
            }}
          />
        )}

        {schedulingDog && (
          <ParkingLotScheduler
            dog={schedulingDog}
            weekStart={schedulingDog.weekStart}
            trainers={data.trainers.map((t) => t.trainer)}
            onClose={() => setSchedulingDog(null)}
            onSaved={() => {
              setSchedulingDog(null);
              refreshData();
            }}
          />
        )}

        {expandedCell && (
          <Dialog open onOpenChange={() => setExpandedCell(null)}>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {expandedCell.label} — Week of{" "}
                  {new Date(expandedCell.weekStart).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </DialogTitle>
              </DialogHeader>
              <div className="flex flex-wrap gap-2 mt-2">
                {expandedCell.dogs.map((dog) => (
                  <Tooltip key={dog.id}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${getDogBadgeClass(dog.type, dog.trainingWeeks)}`}
                      >
                        {dog.name}
                        <span className="ml-1 opacity-70">
                          w{dog.trainingWeeks}
                        </span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Completed {dog.trainingWeeks} weeks of training so far</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {expandedCell.dogs.length} dog{expandedCell.dogs.length !== 1 ? "s" : ""} total
              </p>
            </DialogContent>
          </Dialog>
        )}

        {dropError && (
          <div className="fixed bottom-4 right-4 z-50">
            <div className="bg-destructive text-destructive-foreground rounded-lg px-4 py-3 shadow-lg text-sm flex items-center gap-2">
              <span>{dropError}</span>
              <button
                onClick={() => setDropError(null)}
                className="ml-2 hover:opacity-70 font-bold"
              >
                ×
              </button>
            </div>
          </div>
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
