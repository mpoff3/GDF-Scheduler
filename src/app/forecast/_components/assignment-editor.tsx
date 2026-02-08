"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createAssignment, deleteAssignment } from "@/actions/assignments";

type DogInfo = {
  id: number;
  name: string;
  type: "training" | "class" | "paused";
  assignmentId: number;
  trainingWeeks: number;
};

type AvailableDog = {
  id: number;
  name: string;
  status: string;
};

export function AssignmentEditor({
  trainerId,
  trainerName,
  weekStart,
  currentDogs,
  onClose,
  onSaved,
}: {
  trainerId: number;
  trainerName: string;
  weekStart: string;
  currentDogs: DogInfo[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [availableDogs, setAvailableDogs] = useState<AvailableDog[]>([]);
  const [selectedDogId, setSelectedDogId] = useState<string>("");
  const [assignType, setAssignType] = useState<"training" | "paused">("training");

  const weekDateStr = weekStart.split("T")[0];
  const weekDisplay = new Date(weekStart).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    fetch(`/api/forecast/available-dogs?weekDate=${weekDateStr}&trainerId=${trainerId}`)
      .then((r) => r.json())
      .then((data) => setAvailableDogs(data.dogs || []))
      .catch(() => {});
  }, [weekDateStr, trainerId]);

  function handleAssign() {
    if (!selectedDogId) return;
    setError(null);
    startTransition(async () => {
      try {
        await createAssignment({
          dogId: Number(selectedDogId),
          trainerId,
          weekStartDate: weekDateStr,
          type: assignType,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to assign");
      }
    });
  }

  function handleRemove(dogId: number) {
    setError(null);
    startTransition(async () => {
      try {
        await deleteAssignment(dogId, weekDateStr);
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to remove");
      }
    });
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {trainerName} — Week of {weekDisplay}
          </DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Current Assignments</Label>
            {currentDogs.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">No assignments</p>
            ) : (
              <div className="space-y-2 mt-2">
                {currentDogs.map((dog) => (
                  <div
                    key={dog.id}
                    className="flex items-center justify-between p-2 rounded border"
                  >
                    <div>
                      <span className="font-medium">{dog.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({dog.type}
                        {dog.type === "training" && ` — week ${dog.trainingWeeks}`})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(dog.id)}
                      disabled={isPending}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium">Add Dog</Label>
            <div className="flex gap-2 mt-2">
              <select
                className="flex h-9 flex-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={selectedDogId}
                onChange={(e) => setSelectedDogId(e.target.value)}
              >
                <option value="">Select a dog...</option>
                {availableDogs.map((dog) => (
                  <option key={dog.id} value={dog.id}>
                    {dog.name} ({dog.status.replace(/_/g, " ")})
                  </option>
                ))}
              </select>
              <select
                className="flex h-9 w-28 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={assignType}
                onChange={(e) =>
                  setAssignType(e.target.value as "training" | "paused")
                }
              >
                <option value="training">Training</option>
                <option value="paused">Paused</option>
              </select>
              <Button
                size="sm"
                onClick={handleAssign}
                disabled={isPending || !selectedDogId}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
