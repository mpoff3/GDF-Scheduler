"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assignmentSchema } from "@/lib/validators";
import { fromDateString } from "@/lib/dates";
import { validateTrainerCapacity } from "@/queries/assignments";
import { MIN_TRAINING_WEEKS } from "@/lib/constants";

export async function createAssignment(data: {
  dogId: number;
  trainerId: number;
  weekStartDate: string;
  type: "training" | "class" | "paused";
}) {
  const parsed = assignmentSchema.parse(data);
  const weekStart = fromDateString(parsed.weekStartDate);

  if (parsed.type === "training" || parsed.type === "class") {
    const capacity = await validateTrainerCapacity(
      parsed.trainerId,
      weekStart,
      parsed.type === "class" ? "class" : "training"
    );
    if (!capacity.valid) {
      throw new Error(
        `Trainer at capacity (${capacity.currentCount}/${capacity.maxCount})`
      );
    }
  }

  await prisma.assignment.upsert({
    where: {
      dogId_weekStartDate: {
        dogId: parsed.dogId,
        weekStartDate: weekStart,
      },
    },
    update: {
      trainerId: parsed.trainerId,
      type: parsed.type,
    },
    create: {
      dogId: parsed.dogId,
      trainerId: parsed.trainerId,
      weekStartDate: weekStart,
      type: parsed.type,
    },
  });

  await syncDogStatus(parsed.dogId);
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

export async function deleteAssignment(dogId: number, weekStartDate: string) {
  const weekStart = fromDateString(weekStartDate);

  await prisma.assignment.deleteMany({
    where: { dogId, weekStartDate: weekStart },
  });

  await syncDogStatus(dogId);
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

export async function bulkCreateAssignments(
  assignments: {
    dogId: number;
    trainerId: number;
    weekStartDate: string;
    type: "training" | "class" | "paused";
  }[]
) {
  for (const a of assignments) {
    const weekStart = fromDateString(a.weekStartDate);
    await prisma.assignment.upsert({
      where: {
        dogId_weekStartDate: {
          dogId: a.dogId,
          weekStartDate: weekStart,
        },
      },
      update: {
        trainerId: a.trainerId,
        type: a.type,
      },
      create: {
        dogId: a.dogId,
        trainerId: a.trainerId,
        weekStartDate: weekStart,
        type: a.type,
      },
    });
  }

  const dogIds = [...new Set(assignments.map((a) => a.dogId))];
  for (const dogId of dogIds) {
    await syncDogStatus(dogId);
  }

  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

export async function syncDogStatus(dogId: number) {
  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog || dog.status === "dropout") return;

  // Check if currently in class (has a class assignment for current or future week)
  const now = new Date();
  const classAssignment = await prisma.assignment.findFirst({
    where: { dogId, type: "class" },
    orderBy: { weekStartDate: "desc" },
  });

  if (classAssignment) {
    const classEnd = new Date(classAssignment.weekStartDate);
    classEnd.setDate(classEnd.getDate() + 14);

    if (now >= classEnd) {
      await prisma.dog.update({
        where: { id: dogId },
        data: { status: "graduated" },
      });
      return;
    }

    await prisma.dog.update({
      where: { id: dogId },
      data: { status: "in_class" },
    });
    return;
  }

  // Count training weeks
  const trainingWeeks = await prisma.assignment.count({
    where: { dogId, type: "training" },
  });
  const totalWeeks = trainingWeeks + dog.initialTrainingWeeks;

  if (totalWeeks >= MIN_TRAINING_WEEKS) {
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: "ready_for_class" },
    });
  } else {
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: "in_training" },
    });
  }
}
