"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { dogSchema, recallSchema } from "@/lib/validators";
import { fromDateString, addWeeks, toDateString, getMonday } from "@/lib/dates";
import { MAX_TRAINING_DOGS_PER_TRAINER, MIN_TRAINING_WEEKS } from "@/lib/constants";
import { syncDogStatus } from "@/actions/assignments";

export async function createDog(formData: FormData) {
  const parsed = dogSchema.parse({
    name: formData.get("name"),
    initialTrainingWeeks: formData.get("initialTrainingWeeks") || 0,
  });

  const dog = await prisma.dog.create({
    data: {
      name: parsed.name,
      initialTrainingWeeks: parsed.initialTrainingWeeks,
    },
  });
  await syncDogStatus(dog.id);
  revalidatePath("/dogs");
  redirect("/dogs");
}

export async function updateDog(id: number, formData: FormData) {
  const parsed = dogSchema.parse({
    name: formData.get("name"),
    initialTrainingWeeks: formData.get("initialTrainingWeeks") || 0,
    recallWeekStartDate: formData.get("recallWeekStartDate") ?? "",
  });

  await prisma.dog.update({
    where: { id },
    data: {
      name: parsed.name,
      initialTrainingWeeks: parsed.initialTrainingWeeks,
      recallWeekStartDate:
        parsed.recallWeekStartDate != null
          ? fromDateString(parsed.recallWeekStartDate)
          : null,
    },
  });
  await syncDogStatus(id);
  revalidatePath("/dogs");
  redirect("/dogs");
}

export async function renameDog(id: number, name: string) {
  const parsed = z.string().min(1, "Name is required").max(100).parse(name.trim());
  await prisma.dog.update({
    where: { id },
    data: { name: parsed },
  });
  revalidatePath("/dogs");
  revalidatePath("/forecast");
}

export async function deleteDog(id: number) {
  await prisma.dog.delete({ where: { id } });
  revalidatePath("/dogs");
}

export async function markDogDropout(id: number, weekStartDate?: string) {
  const dropoutWeek = weekStartDate
    ? getMonday(fromDateString(weekStartDate))
    : getMonday(new Date());

  await prisma.dog.update({
    where: { id },
    data: { status: "dropout", dropoutDate: dropoutWeek },
  });
  // Remove assignments from the dropout week onward
  await prisma.assignment.deleteMany({
    where: {
      dogId: id,
      weekStartDate: { gte: dropoutWeek },
    },
  });
  revalidatePath("/dogs");
  revalidatePath("/forecast");
}

export async function reenrollDog(id: number) {
  await prisma.dog.update({
    where: { id },
    data: { status: "in_training", dropoutDate: null },
  });
  await syncDogStatus(id);
  revalidatePath("/dogs");
  revalidatePath("/forecast");
}

export async function scheduleRecall(data: {
  weekStartDate: string;
  dogs: { name: string; trainerId: number; initialTrainingWeeks: number }[];
}) {
  const parsed = recallSchema.parse(data);
  const weekStart = fromDateString(parsed.weekStartDate);

  const defaultWeeks = MIN_TRAINING_WEEKS;

  // Validate trainer capacity for each trainer across all weeks (only dogs with a trainer)
  const trainerDogCounts = new Map<number, number>();
  for (const dog of parsed.dogs) {
    if (dog.trainerId > 0) {
      trainerDogCounts.set(
        dog.trainerId,
        (trainerDogCounts.get(dog.trainerId) || 0) + 1
      );
    }
  }

  // Pre-fetch class weeks for each trainer so we can skip capacity checks
  // and create paused assignments for those weeks
  const trainerClassWeeks = new Map<number, Set<string>>();
  for (const [trainerId] of trainerDogCounts) {
    const classAssignments = await prisma.assignment.findMany({
      where: {
        trainerId,
        weekStartDate: {
          gte: weekStart,
          lt: addWeeks(weekStart, defaultWeeks),
        },
        type: "class",
      },
      select: { weekStartDate: true },
    });
    const classWeekSet = new Set(
      classAssignments.map((a) => a.weekStartDate.toISOString())
    );
    trainerClassWeeks.set(trainerId, classWeekSet);
  }

  for (const [trainerId, newCount] of trainerDogCounts) {
    const classWeeks = trainerClassWeeks.get(trainerId) ?? new Set<string>();

    for (let w = 0; w < defaultWeeks; w++) {
      const weekDate = addWeeks(weekStart, w);

      // Skip capacity check for weeks where trainer has class (dog will be paused)
      if (classWeeks.has(weekDate.toISOString())) continue;

      const existingCount = await prisma.assignment.count({
        where: {
          trainerId,
          weekStartDate: weekDate,
          type: "training",
        },
      });

      if (existingCount + newCount > MAX_TRAINING_DOGS_PER_TRAINER) {
        const trainer = await prisma.trainer.findUnique({
          where: { id: trainerId },
        });
        const weekStr = toDateString(weekDate);
        throw new Error(
          `Trainer ${trainer?.name || trainerId} would exceed capacity for week of ${weekStr} (${existingCount + newCount}/${MAX_TRAINING_DOGS_PER_TRAINER})`
        );
      }
    }
  }

  // Create dogs as "Not Yet IFT" until recall week; assign to trainer (assignments from recall week) or leave unassigned
  for (const dogData of parsed.dogs) {
    const hasTrainer = dogData.trainerId > 0;
    const dog = await prisma.dog.create({
      data: {
        name: dogData.name,
        initialTrainingWeeks: dogData.initialTrainingWeeks,
        status: "not_yet_ift",
        recallWeekStartDate: weekStart,
      },
    });

    if (hasTrainer) {
      const classWeeks = trainerClassWeeks.get(dogData.trainerId) ?? new Set<string>();

      for (let w = 0; w < defaultWeeks; w++) {
        const weekDate = addWeeks(weekStart, w);
        const isClassWeek = classWeeks.has(weekDate.toISOString());

        // Skip class weeks — dog is implicitly in parking lot for those weeks
        if (!isClassWeek) {
          await prisma.assignment.create({
            data: {
              dogId: dog.id,
              trainerId: dogData.trainerId,
              weekStartDate: weekDate,
              type: "training",
            },
          });
        }
      }
      // Don't call syncDogStatus yet; dog stays not_yet_ift until recall week
    }
    // "idk yet..." (no trainer) — no assignments created.
    // Dog is implicitly in parking lot for all weeks.
  }

  revalidatePath("/dogs");
  revalidatePath("/forecast");
}
