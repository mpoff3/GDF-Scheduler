import { prisma } from "@/lib/prisma";
import { addWeeks } from "@/lib/dates";

export type ForecastCell = {
  dogs: {
    id: number;
    name: string;
    type: "training" | "class" | "paused";
    assignmentId: number;
    trainingWeeks: number;
  }[];
};

export type ForecastRow = {
  trainer: { id: number; name: string };
  weeks: Record<string, ForecastCell>; // key = ISO date string
};

export type ForecastData = {
  trainers: ForecastRow[];
  weekStarts: string[];
};

export async function getForecastData(
  startDate: Date,
  weekCount: number
): Promise<ForecastData> {
  const endDate = addWeeks(startDate, weekCount);

  const [trainers, assignments, allDogs] = await Promise.all([
    prisma.trainer.findMany({ orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: {
        weekStartDate: { gte: startDate, lt: endDate },
      },
      include: { dog: true },
    }),
    prisma.dog.findMany({
      where: { status: { notIn: ["dropout"] } },
      include: {
        assignments: {
          where: { type: "training" },
          orderBy: { weekStartDate: "asc" },
        },
      },
    }),
  ]);

  // Pre-compute cumulative training weeks for each dog up to each week
  const dogTrainingWeeksByDate = new Map<number, Map<string, number>>();
  for (const dog of allDogs) {
    const weekMap = new Map<string, number>();
    let cumulative = dog.initialTrainingWeeks;
    // Sort training assignments by date
    const sorted = dog.assignments.sort(
      (a, b) => a.weekStartDate.getTime() - b.weekStartDate.getTime()
    );
    for (const a of sorted) {
      cumulative++;
      weekMap.set(a.weekStartDate.toISOString(), cumulative);
    }
    dogTrainingWeeksByDate.set(dog.id, weekMap);
  }

  // Generate week starts
  const weekStarts: string[] = [];
  for (let i = 0; i < weekCount; i++) {
    weekStarts.push(addWeeks(startDate, i).toISOString());
  }

  // Build rows
  const rows: ForecastRow[] = trainers.map((trainer) => {
    const weeks: Record<string, ForecastCell> = {};

    for (const weekStart of weekStarts) {
      const cellAssignments = assignments.filter(
        (a) =>
          a.trainerId === trainer.id &&
          a.weekStartDate.toISOString() === weekStart
      );

      weeks[weekStart] = {
        dogs: cellAssignments.map((a) => {
          // Get cumulative training weeks for this dog up to this week
          const dogWeekMap = dogTrainingWeeksByDate.get(a.dogId);
          let trainingWeeks = 0;
          if (dogWeekMap) {
            // Find the highest cumulative count up to this week
            for (const [date, count] of dogWeekMap) {
              if (date <= weekStart) {
                trainingWeeks = count;
              }
            }
          }
          // If it's a training week and not yet counted, add one
          if (a.type === "training" && dogWeekMap && !dogWeekMap.has(weekStart)) {
            trainingWeeks++;
          }

          return {
            id: a.dog.id,
            name: a.dog.name,
            type: a.type as "training" | "class" | "paused",
            assignmentId: a.id,
            trainingWeeks,
          };
        }),
      };
    }

    return { trainer: { id: trainer.id, name: trainer.name }, weeks };
  });

  return { trainers: rows, weekStarts };
}
