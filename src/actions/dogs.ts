"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dogSchema, recallSchema } from "@/lib/validators";
import { fromDateString, addWeeks, toDateString } from "@/lib/dates";
import { MAX_TRAINING_DOGS_PER_TRAINER, MIN_TRAINING_WEEKS } from "@/lib/constants";

export async function createDog(formData: FormData) {
  const parsed = dogSchema.parse({
    name: formData.get("name"),
    initialTrainingWeeks: formData.get("initialTrainingWeeks") || 0,
  });

  await prisma.dog.create({
    data: {
      name: parsed.name,
      initialTrainingWeeks: parsed.initialTrainingWeeks,
    },
  });
  revalidatePath("/dogs");
  redirect("/dogs");
}

export async function updateDog(id: number, formData: FormData) {
  const parsed = dogSchema.parse({
    name: formData.get("name"),
    initialTrainingWeeks: formData.get("initialTrainingWeeks") || 0,
  });

  await prisma.dog.update({
    where: { id },
    data: {
      name: parsed.name,
      initialTrainingWeeks: parsed.initialTrainingWeeks,
    },
  });
  revalidatePath("/dogs");
  redirect("/dogs");
}

export async function deleteDog(id: number) {
  await prisma.dog.delete({ where: { id } });
  revalidatePath("/dogs");
}

export async function markDogDropout(id: number) {
  await prisma.dog.update({
    where: { id },
    data: { status: "dropout" },
  });
  // Remove future assignments
  const now = new Date();
  await prisma.assignment.deleteMany({
    where: {
      dogId: id,
      weekStartDate: { gte: now },
    },
  });
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

  // Validate trainer capacity for each trainer across all weeks
  const trainerDogCounts = new Map<number, number>();
  for (const dog of parsed.dogs) {
    trainerDogCounts.set(
      dog.trainerId,
      (trainerDogCounts.get(dog.trainerId) || 0) + 1
    );
  }

  for (const [trainerId, newCount] of trainerDogCounts) {
    for (let w = 0; w < defaultWeeks; w++) {
      const weekDate = addWeeks(weekStart, w);
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

  // Create dogs and their training assignments for 14 weeks
  for (const dogData of parsed.dogs) {
    const dog = await prisma.dog.create({
      data: {
        name: dogData.name,
        initialTrainingWeeks: dogData.initialTrainingWeeks,
        status: "in_training",
      },
    });

    // Create an assignment for each of the 14 weeks
    for (let w = 0; w < defaultWeeks; w++) {
      const weekDate = addWeeks(weekStart, w);
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

  revalidatePath("/dogs");
  revalidatePath("/forecast");
}
