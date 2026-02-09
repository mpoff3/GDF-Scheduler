"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { bulkCreateAssignments } from "@/actions/assignments";
import { MIN_TRAINING_WEEKS } from "@/lib/constants";

type DogInfo = {
  id: number;
  name: string;
  trainingWeeks: number;
};

type Trainer = {
  id: number;
  name: string;
};

function addWeeksISO(isoDate: string, weeks: number): string {
  const d = new Date(isoDate);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

function formatWeekDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ParkingLotScheduler({
  dog,
  weekStart,
  trainers,
  onClose,
  onSaved,
}: {
  dog: DogInfo;
  weekStart: string;
  trainers: Trainer[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const weeksRemaining = Math.max(0, MIN_TRAINING_WEEKS - dog.trainingWeeks);
  const weekDateStr = weekStart.split("T")[0];

  // Build the list of week dates that will be assigned
  const scheduledWeeks: string[] = [];
  for (let i = 0; i < weeksRemaining; i++) {
    scheduledWeeks.push(addWeeksISO(weekDateStr, i));
  }

  function handleSchedule() {
    if (!selectedTrainerId || weeksRemaining === 0) return;
    setError(null);

    const assignments = scheduledWeeks.map((ws) => ({
      dogId: dog.id,
      trainerId: Number(selectedTrainerId),
      weekStartDate: ws,
      type: "training" as const,
    }));

    startTransition(async () => {
      try {
        await bulkCreateAssignments(assignments);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to schedule");
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule {dog.name}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm bg-blue-50 border-blue-200">
              {dog.name}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {dog.trainingWeeks} of {MIN_TRAINING_WEEKS} weeks completed
            </span>
          </div>

          {weeksRemaining === 0 ? (
            <p className="text-sm text-muted-foreground">
              This dog already has {MIN_TRAINING_WEEKS} or more cumulative training weeks.
            </p>
          ) : (
            <>
              <div>
                <Label className="text-sm font-medium">Assign to Trainer</Label>
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={selectedTrainerId}
                  onChange={(e) => setSelectedTrainerId(e.target.value)}
                >
                  <option value="">Select a trainer...</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Schedule Preview ({weeksRemaining} week{weeksRemaining !== 1 ? "s" : ""})
                </Label>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border p-3 space-y-1">
                  {scheduledWeeks.map((ws, i) => (
                    <div
                      key={ws}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">
                        Week {dog.trainingWeeks + i + 1}
                      </span>
                      <span className="font-medium">{formatWeekDate(ws)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleSchedule}
                disabled={isPending || !selectedTrainerId}
              >
                {isPending
                  ? "Scheduling..."
                  : `Schedule ${weeksRemaining} Week${weeksRemaining !== 1 ? "s" : ""} of Training`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
