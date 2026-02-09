import { prisma } from "@/lib/prisma";
import { getMonday, addWeeks } from "@/lib/dates";

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
