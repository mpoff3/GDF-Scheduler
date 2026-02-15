"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { scheduleClass, confirmClass, updateClass, type DisplacedDog } from "@/actions/classes";
import { getMonday, toDateString } from "@/lib/dates";

type DogAssignment = {
  dogId: number;
  trainerId: number;
};

type ExistingClass = {
  id: number;
  startDate: string;
  assignments: { dogId: number; trainerId: number }[];
};

export function ClassScheduleForm({
  trainers,
  readyDogs,
  defaultStartDate,
  existingClass,
}: {
  trainers: { id: number; name: string }[];
  readyDogs: { id: number; name: string; trainingWeeks: number }[];
  defaultStartDate: string;
  existingClass?: ExistingClass;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const initialStartDate = existingClass
    ? existingClass.startDate
    : toDateString(getMonday(new Date()));
  const initialSelected = existingClass
    ? new Set(existingClass.assignments.map((a) => a.dogId))
    : new Set<number>();
  const initialDogTrainerMap = existingClass
    ? Object.fromEntries(existingClass.assignments.map((a) => [a.dogId, a.trainerId]))
    : {};

  const [startDate, setStartDate] = useState(initialStartDate);
  const [assignments, setAssignments] = useState<DogAssignment[]>([]);
  const [displacedDogs, setDisplacedDogs] = useState<DisplacedDog[]>([]);
  const [displacedActions, setDisplacedActions] = useState<
    Record<string, "pause" | "remove">
  >({});

  // Step 1 state: ready dogs for the selected date (fetched when date changes)
  const [readyDogsList, setReadyDogsList] = useState(readyDogs);
  const [loadingReadyDogs, setLoadingReadyDogs] = useState(false);

  // Dogs from the existing class — kept available even when date changes during edit
  const [existingClassDogsList] = useState(() => {
    if (!existingClass) return [] as typeof readyDogs;
    return existingClass.assignments.map((a) => {
      const dog = readyDogs.find((d) => d.id === a.dogId);
      return dog || { id: a.dogId, name: `Dog #${a.dogId}`, trainingWeeks: 14 };
    });
  });

  const effectiveDefaultStartDate = existingClass ? existingClass.startDate : defaultStartDate;

  useEffect(() => {
    if (!startDate) {
      setReadyDogsList([]);
      return;
    }
    // Use server data when date matches default; otherwise fetch for selected date
    if (startDate === effectiveDefaultStartDate) {
      setReadyDogsList(readyDogs);
      return;
    }
    setLoadingReadyDogs(true);
    fetch(`/api/classes/ready-dogs?startDate=${startDate}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then((data) => {
        // When editing, merge in existing class dogs so they remain selectable
        let merged = data;
        if (existingClassDogsList.length > 0) {
          const fetchedIds = new Set(data.map((d: { id: number }) => d.id));
          merged = [...data];
          for (const dog of existingClassDogsList) {
            if (!fetchedIds.has(dog.id)) {
              merged.push(dog);
            }
          }
        }
        setReadyDogsList(merged);
        setSelectedDogs((prev) => {
          const next = new Set(prev);
          const ids = new Set(merged.map((d: { id: number }) => d.id));
          for (const id of next) {
            if (!ids.has(id)) next.delete(id);
          }
          return next;
        });
      })
      .catch(() => setReadyDogsList([]))
      .finally(() => setLoadingReadyDogs(false));
  }, [startDate, effectiveDefaultStartDate, readyDogs, existingClassDogsList]);

  const [selectedDogs, setSelectedDogs] = useState<Set<number>>(initialSelected);
  const [dogTrainerMap, setDogTrainerMap] = useState<Record<number, number>>(initialDogTrainerMap);

  function toggleDog(dogId: number) {
    const next = new Set(selectedDogs);
    if (next.has(dogId)) {
      next.delete(dogId);
    } else {
      next.add(dogId);
      if (!dogTrainerMap[dogId] && trainers.length > 0) {
        setDogTrainerMap((m) => ({ ...m, [dogId]: trainers[0].id }));
      }
    }
    setSelectedDogs(next);
  }

  function setDogTrainer(dogId: number, trainerId: number) {
    setDogTrainerMap((m) => ({ ...m, [dogId]: trainerId }));
  }

  function handleValidate() {
    setError(null);
    const classAssignments: DogAssignment[] = [...selectedDogs].map((dogId) => ({
      dogId,
      trainerId: dogTrainerMap[dogId],
    }));

    setAssignments(classAssignments);

    // No dogs selected — skip validation and displaced check, go straight to confirm
    if (classAssignments.length === 0) {
      setDisplacedDogs([]);
      setDisplacedActions({});
      setStep(3);
      return;
    }

    startTransition(async () => {
      try {
        const result = await scheduleClass({
          startDate,
          assignments: classAssignments,
        });

        if (!result.valid) {
          setError(result.errors.join("\n"));
          return;
        }

        setDisplacedDogs(result.displacedDogs);

        // Default all displaced to pause
        const actions: Record<string, "pause" | "remove"> = {};
        for (const d of result.displacedDogs) {
          actions[`${d.dogId}-${d.weekStartDate}`] = "pause";
        }
        setDisplacedActions(actions);

        if (result.displacedDogs.length > 0) {
          setStep(2);
        } else {
          setStep(3);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Validation failed");
      }
    });
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        if (existingClass) {
          await updateClass({
            classId: existingClass.id,
            startDate,
            assignments,
            displacedActions: displacedDogs.map((d) => ({
              dogId: d.dogId,
              weekStartDate: d.weekStartDate,
              action: displacedActions[`${d.dogId}-${d.weekStartDate}`] || "pause",
            })),
          });
        } else {
          await confirmClass({
            startDate,
            assignments,
            displacedActions: displacedDogs.map((d) => ({
              dogId: d.dogId,
              weekStartDate: d.weekStartDate,
              action: displacedActions[`${d.dogId}-${d.weekStartDate}`] || "pause",
            })),
          });
        }
        router.push("/classes");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save class");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="whitespace-pre-line">{error}</AlertDescription>
        </Alert>
      )}

      {step === 1 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 1: Select Date & Dogs (optional)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Class Start Date (Monday)</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    // Auto-snap to Monday of the selected week
                    const picked = e.target.value;
                    if (picked) {
                      const d = new Date(picked + "T00:00:00");
                      const monday = getMonday(d);
                      setStartDate(toDateString(monday));
                    } else {
                      setStartDate(picked);
                    }
                  }}
                />
              </div>

              {loadingReadyDogs ? (
                <p className="text-sm text-muted-foreground">
                  Loading dogs for selected date…
                </p>
              ) : readyDogsList.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No dogs with 14+ training weeks available for this date.
                  You can still schedule the date and assign dogs later.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Dogs Ready for Class</Label>
                  {readyDogsList.map((dog) => (
                    <div
                      key={dog.id}
                      className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
                        selectedDogs.has(dog.id)
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      }`}
                      onClick={() => toggleDog(dog.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedDogs.has(dog.id)}
                        onChange={() => toggleDog(dog.id)}
                        className="rounded"
                      />
                      <div className="flex-1">
                        <span className="font-medium">{dog.name}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {dog.trainingWeeks} weeks
                        </Badge>
                      </div>
                      {selectedDogs.has(dog.id) && (
                        <select
                          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                          value={dogTrainerMap[dog.id] || ""}
                          onChange={(e) => {
                            e.stopPropagation();
                            setDogTrainer(dog.id, Number(e.target.value));
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {trainers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleValidate} disabled={isPending}>
            {isPending ? "Checking..." : selectedDogs.size === 0 ? "Schedule Date Only" : "Next"}
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Step 2: Handle Displaced Training Dogs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                These training dogs are assigned to trainers who will be in class.
                Choose what to do with each:
              </p>
              {displacedDogs.map((d) => {
                const key = `${d.dogId}-${d.weekStartDate}`;
                return (
                  <div key={key} className="flex items-center gap-3 p-3 rounded border">
                    <div className="flex-1">
                      <span className="font-medium">{d.dogName}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        with {d.trainerName} — week of{" "}
                        {new Date(d.weekStartDate + "T00:00:00Z").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </span>
                    </div>
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                      value={displacedActions[key]}
                      onChange={(e) =>
                        setDisplacedActions((prev) => ({
                          ...prev,
                          [key]: e.target.value as "pause" | "remove",
                        }))
                      }
                    >
                      <option value="pause">Pause</option>
                      <option value="remove">Remove</option>
                    </select>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Next</Button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Step 3: Confirm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm">Start Date</Label>
                <p className="text-sm">
                  {new Date(startDate + "T00:00:00Z").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  })}
                </p>
              </div>
              <div>
                <Label className="text-sm">Dog-Trainer Pairs</Label>
                {assignments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No dogs or trainers assigned yet. You can add them later by editing this class.
                  </p>
                ) : (
                  assignments.map((a) => {
                    const dog = readyDogsList.find((d) => d.id === a.dogId) ?? readyDogs.find((d) => d.id === a.dogId);
                    const trainer = trainers.find((t) => t.id === a.trainerId);
                    return (
                      <p key={a.dogId} className="text-sm">
                        {dog?.name} with {trainer?.name}
                      </p>
                    );
                  })
                )}
              </div>
              {displacedDogs.length > 0 && (
                <div>
                  <Label className="text-sm">Displaced Dogs</Label>
                  {displacedDogs.map((d) => {
                    const key = `${d.dogId}-${d.weekStartDate}`;
                    return (
                      <p key={key} className="text-sm">
                        {d.dogName} — {displacedActions[key]}
                      </p>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setStep(displacedDogs.length > 0 ? 2 : 1)}
            >
              Back
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              {isPending
                ? (existingClass ? "Updating..." : "Scheduling...")
                : existingClass
                  ? "Update Class"
                  : "Confirm & Schedule"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
