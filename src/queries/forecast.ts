import { prisma } from "@/lib/prisma";
import { addWeeks } from "@/lib/dates";

export type ForecastCell = {
  dogs: {
    id: number;
    name: string;
    type: "training" | "class" | "paused" | "graduated" | "dropout" | "not_yet_ift";
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
  /** ISO week start dates where at least one dog has a recall scheduled (start of IFT) */
  recallWeekStarts: string[];
  /** Number of dogs being recalled (IFT start) per week start date */
  recallCountByWeek: Record<string, number>;
  /** ISO week start dates where a class is scheduled */
  classWeekStarts: string[];
  /** Row for unassigned dogs (parking lot), per week */
  parkingLot: ForecastRow;
  /** Row for dogs not yet in formal training (recall scheduled but not started) */
  notYetIft: ForecastRow;
  /** Row for dogs that have completed class */
  graduated: ForecastRow;
  /** Row for dogs that dropped out of the program */
  droppedOut: ForecastRow;
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
    // Include all dogs (including dropout) so past assignments show with correct training weeks
    prisma.dog.findMany({
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

  // Helper: get cumulative training weeks for a dog up to a given week
  function getTrainingWeeks(dogId: number, weekStart: string, initialWeeks: number): number {
    const dogWeekMap = dogTrainingWeeksByDate.get(dogId);
    let trainingWeeks = initialWeeks;
    if (dogWeekMap) {
      for (const [date, count] of dogWeekMap) {
        if (date <= weekStart) {
          trainingWeeks = count;
        }
      }
    }
    return trainingWeeks;
  }

  // Generate week starts
  const weekStarts: string[] = [];
  for (let i = 0; i < weekCount; i++) {
    weekStarts.push(addWeeks(startDate, i).toISOString());
  }

  // Build trainer rows — all assignments now have a trainer
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
          let trainingWeeks = getTrainingWeeks(a.dogId, weekStart, a.dog.initialTrainingWeeks ?? 0);
          // If it's a training week and not yet counted, add one
          const dogWeekMap = dogTrainingWeeksByDate.get(a.dogId);
          if (a.type === "training" && dogWeekMap && !dogWeekMap.has(weekStart)) {
            trainingWeeks++;
          }

          return {
            id: a.dog.id,
            name: a.dog.name,
            type: a.type as "training" | "class",
            assignmentId: a.id,
            trainingWeeks,
          };
        }),
      };
    }

    return { trainer: { id: trainer.id, name: trainer.name }, weeks };
  });

  // --- Not Yet IFT row ---
  // Dogs with a recallWeekStartDate appear in this row for weeks BEFORE their recall date.
  // From their recall date onward they have regular assignments in trainer/parking lot rows.
  // We filter by recallWeekStartDate only (not status) because the dog's current status may
  // have already transitioned to "in_training" once the recall week arrived, but the forecast
  // is a multi-week view and should still show the dog as "Not Yet IFT" for past weeks.
  const notYetIftDogs = allDogs.filter(
    (d) => d.recallWeekStartDate
  );
  const notYetIftWeeks: Record<string, ForecastCell> = {};
  for (const weekStart of weekStarts) {
    const weekDate = new Date(weekStart);
    const dogs: ForecastCell["dogs"] = [];
    for (const dog of notYetIftDogs) {
      if (dog.recallWeekStartDate && weekDate < dog.recallWeekStartDate) {
        dogs.push({
          id: dog.id,
          name: dog.name,
          type: "not_yet_ift",
          assignmentId: -1,
          trainingWeeks: 0,
        });
      }
    }
    notYetIftWeeks[weekStart] = { dogs };
  }
  const notYetIft: ForecastRow = {
    trainer: { id: -2, name: "Not Yet IFT" },
    weeks: notYetIftWeeks,
  };

  // Recall weeks: week starts in our range where at least one dog has recallWeekStartDate (compare date-only for timezone safety)
  const recallWeekStarts = weekStarts.filter((ws) =>
    notYetIftDogs.some(
      (d) =>
        d.recallWeekStartDate &&
        ws.split("T")[0] === d.recallWeekStartDate.toISOString().split("T")[0]
    )
  );

  // Count dogs being recalled (IFT start) per week (all dogs with recallWeekStartDate set, not just not_yet_ift)
  const recallCountByWeek: Record<string, number> = {};
  for (const ws of weekStarts) {
    const wsDate = ws.split("T")[0];
    recallCountByWeek[ws] = allDogs.filter(
      (d) =>
        d.recallWeekStartDate &&
        wsDate === d.recallWeekStartDate.toISOString().split("T")[0]
    ).length;
  }

  // Class weeks: week 1 (class start) and week 2 of each class get the "Class" label
  const classStartMin = addWeeks(startDate, -1); // include classes that started week before (their week 2 is in range)
  const classesInRange = await prisma.class.findMany({
    where: {
      startDate: { gte: classStartMin, lt: endDate },
    },
  });
  const classWeekStarts = weekStarts.filter((ws) =>
    classesInRange.some((c) => {
      const week1 = c.startDate.toISOString().split("T")[0];
      const week2 = addWeeks(c.startDate, 1).toISOString().split("T")[0];
      const wsDate = ws.split("T")[0];
      return wsDate === week1 || wsDate === week2;
    })
  );

  // --- Graduated row ---
  // A dog is graduated for a given week if the week is AFTER their last class assignment week.
  // Find the latest class assignment per dog → graduation starts the following week.
  const classAssignmentsAll = await prisma.assignment.findMany({
    where: { type: "class" },
    include: { dog: true },
    orderBy: { weekStartDate: "desc" },
  });
  const dogGraduationWeek = new Map<number, { date: string; name: string }>();
  for (const a of classAssignmentsAll) {
    // Only first (latest) class assignment per dog, skip dropout dogs
    if (!dogGraduationWeek.has(a.dogId) && a.dog.status !== "dropout") {
      const gradDate = addWeeks(a.weekStartDate, 1);
      dogGraduationWeek.set(a.dogId, {
        date: gradDate.toISOString(),
        name: a.dog.name,
      });
    }
  }
  const graduatedWeeks: Record<string, ForecastCell> = {};
  for (const weekStart of weekStarts) {
    const dogs: ForecastCell["dogs"] = [];
    for (const [dogId, info] of dogGraduationWeek) {
      if (weekStart >= info.date) {
        const dog = allDogs.find((d) => d.id === dogId);
        const trainingWeeks =
          dog != null
            ? dog.initialTrainingWeeks + dog.assignments.length
            : 0;
        dogs.push({
          id: dogId,
          name: info.name,
          type: "graduated",
          assignmentId: -1,
          trainingWeeks,
        });
      }
    }
    graduatedWeeks[weekStart] = { dogs };
  }
  const graduated: ForecastRow = {
    trainer: { id: -3, name: "Graduated" },
    weeks: graduatedWeeks,
  };

  // --- Dropped Out row ---
  // Dogs with status "dropout" appear here for weeks on or after their dropoutDate.
  const dropoutDogs = await prisma.dog.findMany({
    where: { status: "dropout" },
  });
  const droppedOutWeeks: Record<string, ForecastCell> = {};
  for (const weekStart of weekStarts) {
    const dogs: ForecastCell["dogs"] = [];
    for (const dog of dropoutDogs) {
      const dropoutStart = dog.dropoutDate
        ? dog.dropoutDate.toISOString()
        : new Date(0).toISOString();
      if (weekStart >= dropoutStart) {
        dogs.push({
          id: dog.id,
          name: dog.name,
          type: "dropout",
          assignmentId: -1,
          trainingWeeks: 0,
        });
      }
    }
    droppedOutWeeks[weekStart] = { dogs };
  }
  const droppedOut: ForecastRow = {
    trainer: { id: -4, name: "Dropped Out" },
    weeks: droppedOutWeeks,
  };

  // --- Parking Lot ---
  // Dogs that have started (have at least one assignment, or have a recall date that has passed)
  // but don't appear in any other row for that week are shown in the Parking Lot.
  const earliestAssignments = await prisma.assignment.groupBy({
    by: ["dogId"],
    _min: { weekStartDate: true },
  });
  const dogStartDate = new Map<number, string>();
  for (const ea of earliestAssignments) {
    if (ea._min.weekStartDate) {
      dogStartDate.set(ea.dogId, ea._min.weekStartDate.toISOString());
    }
  }
  // Also consider recallWeekStartDate as a start date for dogs added via recall.
  // Use the EARLIEST of recallWeekStartDate and first assignment so a dog that was
  // recalled (and thus "started") before their first assignment still appears in
  // the parking lot for all weeks from recall onward.
  for (const dog of allDogs) {
    if (dog.recallWeekStartDate) {
      const recallStr = dog.recallWeekStartDate.toISOString();
      const existing = dogStartDate.get(dog.id);
      if (!existing || recallStr < existing) {
        dogStartDate.set(dog.id, recallStr);
      }
    }
  }
  const dogInfoMap = new Map(allDogs.map((d) => [d.id, d]));

  const parkingLotWeeks: Record<string, ForecastCell> = {};
  for (const weekStart of weekStarts) {
    // Collect all dog IDs already appearing in any row for this week
    const assignedDogIds = new Set<number>();

    for (const row of rows) {
      for (const dog of row.weeks[weekStart]?.dogs || []) {
        assignedDogIds.add(dog.id);
      }
    }
    for (const dog of notYetIftWeeks[weekStart]?.dogs || []) {
      assignedDogIds.add(dog.id);
    }
    for (const dog of graduatedWeeks[weekStart]?.dogs || []) {
      assignedDogIds.add(dog.id);
    }
    for (const dog of droppedOutWeeks[weekStart]?.dogs || []) {
      assignedDogIds.add(dog.id);
    }

    const dogs: ForecastCell["dogs"] = [];

    // Find dogs that have started but don't appear in any row
    for (const [dogId, startDateStr] of dogStartDate) {
      if (startDateStr <= weekStart && !assignedDogIds.has(dogId)) {
        const dog = dogInfoMap.get(dogId);
        if (!dog) continue;

        const trainingWeeks = getTrainingWeeks(dogId, weekStart, dog.initialTrainingWeeks);

        dogs.push({
          id: dog.id,
          name: dog.name,
          type: "paused",
          assignmentId: -1,
          trainingWeeks,
        });
      }
    }

    parkingLotWeeks[weekStart] = { dogs };
  }
  const parkingLot: ForecastRow = {
    trainer: { id: -1, name: "Parking Lot" },
    weeks: parkingLotWeeks,
  };

  return {
    trainers: rows,
    weekStarts,
    recallWeekStarts,
    recallCountByWeek,
    classWeekStarts,
    parkingLot,
    notYetIft,
    graduated,
    droppedOut,
  };
}
