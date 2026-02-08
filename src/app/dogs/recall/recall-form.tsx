"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { scheduleRecall } from "@/actions/dogs";
import { getMonday, toDateString } from "@/lib/dates";

type DogRow = {
  name: string;
  trainerId: string;
  initialTrainingWeeks: string;
};

export function RecallForm({
  trainers,
}: {
  trainers: { id: number; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState(
    toDateString(getMonday(new Date()))
  );
  const [dogs, setDogs] = useState<DogRow[]>([
    { name: "", trainerId: trainers[0]?.id.toString() || "", initialTrainingWeeks: "0" },
  ]);

  function addRow() {
    setDogs([
      ...dogs,
      { name: "", trainerId: trainers[0]?.id.toString() || "", initialTrainingWeeks: "0" },
    ]);
  }

  function removeRow(index: number) {
    setDogs(dogs.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: keyof DogRow, value: string) {
    const updated = [...dogs];
    updated[index] = { ...updated[index], [field]: value };
    setDogs(updated);
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await scheduleRecall({
          weekStartDate,
          dogs: dogs.map((d) => ({
            name: d.name,
            trainerId: Number(d.trainerId),
            initialTrainingWeeks: Number(d.initialTrainingWeeks),
          })),
        });
        router.push("/dogs");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "An error occurred");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="weekStartDate">Week Start Date (Monday)</Label>
        <Input
          id="weekStartDate"
          type="date"
          value={weekStartDate}
          onChange={(e) => setWeekStartDate(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <Label>Dogs</Label>
        {dogs.map((dog, i) => (
          <Card key={i}>
            <CardContent className="flex gap-3 items-end pt-4">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={dog.name}
                  onChange={(e) => updateRow(i, "name", e.target.value)}
                  placeholder="Dog name"
                  required
                />
              </div>
              <div className="w-40 space-y-1">
                <Label className="text-xs">Trainer</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={dog.trainerId}
                  onChange={(e) => updateRow(i, "trainerId", e.target.value)}
                >
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-xs">Prior Weeks</Label>
                <Input
                  type="number"
                  min={0}
                  max={22}
                  value={dog.initialTrainingWeeks}
                  onChange={(e) =>
                    updateRow(i, "initialTrainingWeeks", e.target.value)
                  }
                />
              </div>
              {dogs.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRow(i)}
                  type="button"
                >
                  Remove
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={addRow}>
          Add Dog
        </Button>
        <Button onClick={handleSubmit} disabled={isPending}>
          {isPending ? "Scheduling..." : "Schedule Recall"}
        </Button>
      </div>
    </div>
  );
}
