"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { fromDateString, addWeeks, toDateString, getMonday } from "@/lib/dates";
import { MAX_CLASS_DOGS_PER_TRAINER, CLASS_DURATION_WEEKS } from "@/lib/constants";
import { syncDogStatus } from "@/actions/assignments";

export type DisplacedDog = {
  dogId: number;
  dogName: string;
  trainerId: number;
  trainerName: string;
  weekStartDate: string;
};

export type ScheduleClassResult = {
  valid: boolean;
  errors: string[];
  displacedDogs: DisplacedDog[];
};

export async function scheduleClass(data: {
  startDate: string;
  assignments: { dogId: number; trainerId: number }[];
}): Promise<ScheduleClassResult> {
  // Normalize to Monday of the selected week so assignments align with forecast grid
  const startDate = getMonday(fromDateString(data.startDate));
  const errors: string[] = [];
  const displacedDogs: DisplacedDog[] = [];

  // Validate trainer limits
  const trainerDogCounts = new Map<number, number>();
  for (const a of data.assignments) {
    trainerDogCounts.set(a.trainerId, (trainerDogCounts.get(a.trainerId) || 0) + 1);
  }

  for (const [trainerId, count] of trainerDogCounts) {
    if (count > MAX_CLASS_DOGS_PER_TRAINER) {
      const trainer = await prisma.trainer.findUnique({ where: { id: trainerId } });
      errors.push(
        `Trainer ${trainer?.name} has ${count} dogs assigned (max ${MAX_CLASS_DOGS_PER_TRAINER})`
      );
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, displacedDogs: [] };
  }

  // Collect training dogs that would be displaced during class weeks (move to parking lot)
  const trainerIds = [...new Set(data.assignments.map((a) => a.trainerId))];
  // Exclude ALL dogs in the class (not just those for the current trainer) so that a
  // class dog whose prior training assignment was with a different class-trainer isn't
  // mistakenly flagged as displaced.
  const allClassDogIds = new Set(data.assignments.map((a) => a.dogId));

  for (const trainerId of trainerIds) {
    for (let w = 0; w < CLASS_DURATION_WEEKS; w++) {
      const weekDate = addWeeks(startDate, w);

      const trainingAssignments = await prisma.assignment.findMany({
        where: {
          trainerId,
          weekStartDate: weekDate,
          type: "training",
          dogId: { notIn: [...allClassDogIds] },
        },
        include: { dog: true, trainer: true },
      });

      for (const a of trainingAssignments) {
        if (!a.trainer) continue;
        displacedDogs.push({
          dogId: a.dogId,
          dogName: a.dog.name,
          trainerId: a.trainerId,
          trainerName: a.trainer.name,
          weekStartDate: toDateString(weekDate),
        });
      }
    }
  }

  return { valid: true, errors: [], displacedDogs };
}

export async function confirmClass(data: {
  startDate: string;
  assignments: { dogId: number; trainerId: number }[];
  displacedActions: { dogId: number; weekStartDate: string; action: "pause" | "remove" }[];
}) {
  // Normalize to Monday of the selected week so assignments align with forecast grid
  const startDate = getMonday(fromDateString(data.startDate));

  // Create the class
  const cls = await prisma.class.create({
    data: { startDate },
  });

  // Create class assignments and week assignments
  for (const a of data.assignments) {
    await prisma.classAssignment.create({
      data: {
        classId: cls.id,
        trainerId: a.trainerId,
        dogId: a.dogId,
      },
    });

    // Create assignment records for each class week
    for (let w = 0; w < CLASS_DURATION_WEEKS; w++) {
      const weekDate = addWeeks(startDate, w);
      await prisma.assignment.upsert({
        where: {
          dogId_weekStartDate: {
            dogId: a.dogId,
            weekStartDate: weekDate,
          },
        },
        update: {
          trainerId: a.trainerId,
          type: "class",
        },
        create: {
          dogId: a.dogId,
          trainerId: a.trainerId,
          weekStartDate: weekDate,
          type: "class",
        },
      });
    }

    await syncDogStatus(a.dogId);
  }

  // Handle displaced dogs: both "pause" (parking lot) and "remove" delete the assignment.
  // The dog is implicitly in the parking lot when they have no assignment for that week.
  // Safety: never overwrite a class dog's assignment
  const classDogIds = new Set(data.assignments.map((a) => a.dogId));
  for (const d of data.displacedActions) {
    if (classDogIds.has(d.dogId)) continue; // skip class dogs
    const weekDate = fromDateString(d.weekStartDate);
    await prisma.assignment.deleteMany({
      where: { dogId: d.dogId, weekStartDate: weekDate },
    });
    await syncDogStatus(d.dogId);
  }

  revalidatePath("/classes");
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

export async function updateClass(data: {
  classId: number;
  startDate: string;
  assignments: { dogId: number; trainerId: number }[];
  displacedActions: { dogId: number; weekStartDate: string; action: "pause" | "remove" }[];
}) {
  const newStartDate = getMonday(fromDateString(data.startDate));

  const cls = await prisma.class.findUnique({
    where: { id: data.classId },
    include: { classAssignments: true },
  });
  if (!cls) throw new Error("Class not found");

  const oldStartDate = cls.startDate;

  // Remove old class assignments and their assignment rows (using OLD start date)
  for (const ca of cls.classAssignments) {
    for (let w = 0; w < CLASS_DURATION_WEEKS; w++) {
      const weekDate = addWeeks(oldStartDate, w);
      await prisma.assignment.deleteMany({
        where: {
          dogId: ca.dogId,
          weekStartDate: weekDate,
        },
      });
    }
    await syncDogStatus(ca.dogId);
  }
  await prisma.classAssignment.deleteMany({
    where: { classId: data.classId },
  });

  // Update class start date
  await prisma.class.update({
    where: { id: data.classId },
    data: { startDate: newStartDate },
  });

  // Create new class assignments and assignment rows (using NEW start date)
  for (const a of data.assignments) {
    await prisma.classAssignment.create({
      data: {
        classId: data.classId,
        trainerId: a.trainerId,
        dogId: a.dogId,
      },
    });

    for (let w = 0; w < CLASS_DURATION_WEEKS; w++) {
      const weekDate = addWeeks(newStartDate, w);
      await prisma.assignment.upsert({
        where: {
          dogId_weekStartDate: {
            dogId: a.dogId,
            weekStartDate: weekDate,
          },
        },
        update: {
          trainerId: a.trainerId,
          type: "class",
        },
        create: {
          dogId: a.dogId,
          trainerId: a.trainerId,
          weekStartDate: weekDate,
          type: "class",
        },
      });
    }

    await syncDogStatus(a.dogId);
  }

  // Handle displaced dogs: both "pause" (parking lot) and "remove" delete the assignment.
  // The dog is implicitly in the parking lot when they have no assignment for that week.
  // Safety: never overwrite a class dog's assignment
  const updatedClassDogIds = new Set(data.assignments.map((a) => a.dogId));
  for (const d of data.displacedActions) {
    if (updatedClassDogIds.has(d.dogId)) continue; // skip class dogs
    const weekDate = fromDateString(d.weekStartDate);
    await prisma.assignment.deleteMany({
      where: { dogId: d.dogId, weekStartDate: weekDate },
    });
    await syncDogStatus(d.dogId);
  }

  revalidatePath("/classes");
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

export async function deleteClass(classId: number) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: { classAssignments: true },
  });
  if (!cls) throw new Error("Class not found");

  const startDate = cls.startDate;

  // Remove assignment rows for each class week and sync dog status
  for (const ca of cls.classAssignments) {
    for (let w = 0; w < CLASS_DURATION_WEEKS; w++) {
      const weekDate = addWeeks(startDate, w);
      await prisma.assignment.deleteMany({
        where: {
          dogId: ca.dogId,
          weekStartDate: weekDate,
        },
      });
    }
    await syncDogStatus(ca.dogId);
  }

  // Cascade will delete classAssignments
  await prisma.class.delete({
    where: { id: classId },
  });

  revalidatePath("/classes");
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}
