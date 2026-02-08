"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { dogSchema, recallSchema } from "@/lib/validators";
import { fromDateString } from "@/lib/dates";
import { MAX_TRAINING_DOGS_PER_TRAINER } from "@/lib/constants";

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

  // Validate trainer capacity for each trainer
  const trainerDogCounts = new Map<number, number>();
  for (const dog of parsed.dogs) {
    trainerDogCounts.set(
      dog.trainerId,
      (trainerDogCounts.get(dog.trainerId) || 0) + 1
    );
  }

  for (const [trainerId, newCount] of trainerDogCounts) {
    const existingCount = await prisma.assignment.count({
      where: {
        trainerId,
        weekStartDate: weekStart,
        type: "training",
      },
    });

    if (existingCount + newCount > MAX_TRAINING_DOGS_PER_TRAINER) {
      const trainer = await prisma.trainer.findUnique({
        where: { id: trainerId },
      });
      throw new Error(
        `Trainer ${trainer?.name || trainerId} would exceed capacity (${existingCount + newCount}/${MAX_TRAINING_DOGS_PER_TRAINER})`
      );
    }
  }

  // Create dogs and their first training assignments
  for (const dogData of parsed.dogs) {
    const dog = await prisma.dog.create({
      data: {
        name: dogData.name,
        initialTrainingWeeks: dogData.initialTrainingWeeks,
        status: "in_training",
      },
    });

    await prisma.assignment.create({
      data: {
        dogId: dog.id,
        trainerId: dogData.trainerId,
        weekStartDate: weekStart,
        type: "training",
      },
    });
  }

  revalidatePath("/dogs");
  revalidatePath("/forecast");
}
