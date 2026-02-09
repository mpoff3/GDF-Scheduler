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

  // Find displaced training dogs for each class week
  const trainerIds = [...new Set(data.assignments.map((a) => a.trainerId))];

  for (let w = 0; w < CLASS_DURATION_WEEKS; w++) {
    const weekDate = addWeeks(startDate, w);

    for (const trainerId of trainerIds) {
      const existingAssignments = await prisma.assignment.findMany({
        where: {
          trainerId,
          weekStartDate: weekDate,
          type: "training",
        },
        include: { dog: true, trainer: true },
      });

      for (const ea of existingAssignments) {
        // Only displaced if the dog is not being assigned to class
        const isClassDog = data.assignments.some(
          (a) => a.dogId === ea.dogId && a.trainerId === ea.trainerId
        );
        if (!isClassDog) {
          displacedDogs.push({
            dogId: ea.dogId,
            dogName: ea.dog.name,
            trainerId: ea.trainerId,
            trainerName: ea.trainer.name,
            weekStartDate: toDateString(weekDate),
          });
        }
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

  // Handle displaced dogs
  for (const d of data.displacedActions) {
    const weekDate = fromDateString(d.weekStartDate);
    if (d.action === "pause") {
      await prisma.assignment.updateMany({
        where: { dogId: d.dogId, weekStartDate: weekDate },
        data: { type: "paused" },
      });
    } else {
      await prisma.assignment.deleteMany({
        where: { dogId: d.dogId, weekStartDate: weekDate },
      });
    }
    await syncDogStatus(d.dogId);
  }

  revalidatePath("/classes");
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}
