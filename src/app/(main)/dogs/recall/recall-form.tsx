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
};

const UNASSIGNED_TRAINER_VALUE = "";

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
  const [dogs, setDogs] = useState<DogRow[]>([]);
  const [numDogsToAdd, setNumDogsToAdd] = useState(12);

  function addMultipleRows(count: number) {
    const n = Math.max(1, Math.min(50, count));
    const newRows: DogRow[] = Array.from({ length: n }, () => ({
      name: "",
      trainerId: UNASSIGNED_TRAINER_VALUE,
    }));
    setDogs([...dogs, ...newRows]);
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
            trainerId: d.trainerId === "" ? 0 : Number(d.trainerId),
            initialTrainingWeeks: 0,
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
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Number of dogs</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={numDogsToAdd}
              onChange={(e) =>
                setNumDogsToAdd(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 1)))
              }
              className="w-24"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => addMultipleRows(numDogsToAdd)}
          >
            Add {numDogsToAdd} Dog{numDogsToAdd !== 1 ? "s" : ""}
          </Button>
        </div>
        {dogs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            Choose how many dogs above and click &quot;Add X Dogs&quot; to create slots, then fill in names and trainers.
          </p>
        ) : (
          <>
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
                      <option value="">idk yet...</option>
                      {trainers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRow(i)}
                    type="button"
                  >
                    Remove
                  </Button>
                </CardContent>
              </Card>
            ))}
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Scheduling..." : "Schedule Recall"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
