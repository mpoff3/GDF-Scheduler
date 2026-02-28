import { prisma } from "@/lib/prisma";
import { getMonday, addWeeks, toDateString } from "@/lib/dates";

/** One dog in a recall event (for list/edit) */
export type RecallEventDog = {
  id: number;
  name: string;
  trainerId: number | null;
  trainerName: string | null;
};

/** Recall event grouped by week start date */
export type RecallEvent = {
  weekStartDate: string;
  dogs: RecallEventDog[];
};

export async function getDogs() {
  const now = new Date();
  const startOfThisWeek = getMonday(now);

  const dogs = await prisma.dog.findMany({
    orderBy: { name: "asc" },
    include: {
      assignments: {
        where: {
          type: "training",
          weekStartDate: { lt: startOfThisWeek },
        },
      },
    },
  });

  return dogs
    .map((dog) => ({
      id: dog.id,
      name: dog.name,
      status: dog.status,
      initialTrainingWeeks: dog.initialTrainingWeeks,
      recallWeekStartDate: dog.recallWeekStartDate,
      createdAt: dog.createdAt,
      updatedAt: dog.updatedAt,
      cumulativeTrainingWeeks: dog.initialTrainingWeeks + dog.assignments.length,
    }))
    .sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" })
    );
}

export async function getDogById(id: number) {
  return prisma.dog.findUnique({ where: { id } });
}

export async function getDogTrainingWeeks(dogId: number): Promise<number> {
  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog) return 0;

  const now = new Date();
  const startOfThisWeek = getMonday(now);
  const completedTrainingWeeks = await prisma.assignment.count({
    where: {
      dogId,
      type: "training",
      weekStartDate: { lt: startOfThisWeek },
    },
  });

  return completedTrainingWeeks + dog.initialTrainingWeeks;
}

/**
 * Returns dogs with 14+ training weeks. When asOfDate is provided, counts
 * training weeks through that week (matches forecast logic). Otherwise counts
 * only completed weeks (before start of this week).
 */
export async function getDogsReadyForClass(asOfDate?: Date) {
  const now = new Date();
  const startOfThisWeek = getMonday(now);
  const cutoff =
    asOfDate != null
      ? getMonday(asOfDate)
      : startOfThisWeek;
  const isClassDate = asOfDate != null;
  // For a selected class date: count assignments through that week (lte).
  // For "today": count only completed weeks before this week (lt).
  const weekFilter = isClassDate ? { lte: cutoff } : { lt: cutoff };

  const dogs = await prisma.dog.findMany({
    where: {
      OR: [
        // Dogs currently in training or ready for class
        { status: { in: ["in_training", "ready_for_class", "paused"] } },
        // Not-yet-IFT dogs whose recall week is on or before the target date
        // (they will be actively training by then and may have enough weeks)
        ...(isClassDate
          ? [
              {
                status: "not_yet_ift" as const,
                recallWeekStartDate: { lte: cutoff },
              },
            ]
          : []),
      ],
    },
    include: {
      assignments: {
        where: {
          type: "training",
          weekStartDate: weekFilter,
        },
      },
    },
  });

  // When scheduling for a future date, exclude dogs that will be graduated
  // by then. A dog graduates the week after their last class assignment.
  const graduatedIds = new Set<number>();
  if (isClassDate) {
    const dogIds = dogs.map((d) => d.id);
    if (dogIds.length > 0) {
      const classAssignments = await prisma.assignment.findMany({
        where: {
          type: "class",
          dogId: { in: dogIds },
        },
        select: { dogId: true, weekStartDate: true },
      });
      // Find last class week per dog
      const lastClassWeek = new Map<number, Date>();
      for (const a of classAssignments) {
        const existing = lastClassWeek.get(a.dogId);
        if (!existing || a.weekStartDate > existing) {
          lastClassWeek.set(a.dogId, a.weekStartDate);
        }
      }
      for (const [dogId, lastWeek] of lastClassWeek) {
        // Graduated the week after their last class week
        if (addWeeks(lastWeek, 1) <= cutoff) {
          graduatedIds.add(dogId);
        }
      }
    }
  }

  return dogs
    .filter((dog) => !graduatedIds.has(dog.id))
    .map((dog) => ({
      ...dog,
      trainingWeeks: dog.assignments.length + dog.initialTrainingWeeks,
    }))
    .filter((dog) => dog.trainingWeeks >= 14);
}

/**
 * Returns recall events grouped by recall week (Monday). Each event includes
 * dogs and their trainer assignment for that week (from training assignments).
 */
export async function getRecallEvents(): Promise<RecallEvent[]> {
  const dogs = await prisma.dog.findMany({
    where: { recallWeekStartDate: { not: null } },
    select: { id: true, name: true, recallWeekStartDate: true },
    orderBy: { name: "asc" },
  });
  if (dogs.length === 0) return [];

  const assignments = await prisma.assignment.findMany({
    where: {
      dogId: { in: dogs.map((d) => d.id) },
      weekStartDate: { in: dogs.map((d) => d.recallWeekStartDate!) },
      type: "training",
    },
    include: { trainer: { select: { id: true, name: true } } },
  });

  const byWeek = new Map<
    string,
    { dogs: RecallEventDog[] }
  >();
  for (const dog of dogs) {
    const week = dog.recallWeekStartDate!;
    const key = toDateString(week);
    if (!byWeek.has(key))
      byWeek.set(key, { dogs: [] });
    const assign = assignments.find(
      (a) =>
        a.dogId === dog.id &&
        a.weekStartDate.getTime() === week.getTime()
    );
    byWeek.get(key)!.dogs.push({
      id: dog.id,
      name: dog.name,
      trainerId: assign?.trainerId ?? null,
      trainerName: assign?.trainer?.name ?? null,
    });
  }
  return Array.from(byWeek.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // most recent first
    .map(([weekStartDate, v]) => ({ weekStartDate, dogs: v.dogs }));
}

/**
 * Returns a single recall event for the given week start (YYYY-MM-DD), or null.
 * Normalizes the given date to Monday of that week.
 */
export async function getRecallEventByWeekStart(
  weekStartDateStr: string
): Promise<RecallEvent | null> {
  const weekStart = getMonday(new Date(weekStartDateStr + "T00:00:00.000Z"));
  const normalizedKey = toDateString(weekStart);
  const dogs = await prisma.dog.findMany({
    where: {
      recallWeekStartDate: weekStart,
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  if (dogs.length === 0) return null;

  const assignments = await prisma.assignment.findMany({
    where: {
      dogId: { in: dogs.map((d) => d.id) },
      weekStartDate: weekStart,
      type: "training",
    },
    include: { trainer: { select: { id: true, name: true } } },
  });
  const assignByDog = new Map(
    assignments.map((a) => [a.dogId, a])
  );

  const recallDogs: RecallEventDog[] = dogs.map((d) => {
    const assign = assignByDog.get(d.id);
    return {
      id: d.id,
      name: d.name,
      trainerId: assign?.trainerId ?? null,
      trainerName: assign?.trainer?.name ?? null,
    };
  });

  return { weekStartDate: normalizedKey, dogs: recallDogs };
}
