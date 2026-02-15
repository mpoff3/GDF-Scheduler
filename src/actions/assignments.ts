"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assignmentSchema } from "@/lib/validators";
import { fromDateString, getMonday, addWeeks } from "@/lib/dates";
import { validateTrainerCapacity } from "@/queries/assignments";
import { MIN_TRAINING_WEEKS } from "@/lib/constants";

export async function createAssignment(data: {
  dogId: number;
  trainerId: number;
  weekStartDate: string;
  type: "training" | "class";
}) {
  const parsed = assignmentSchema.parse(data);
  const weekStart = fromDateString(parsed.weekStartDate);

  const capacity = await validateTrainerCapacity(
    parsed.trainerId,
    weekStart,
    parsed.type === "class" ? "class" : "training"
  );
  if (!capacity.valid) {
    if (capacity.maxCount === 0) {
      throw new Error("Trainer is doing class this week; cannot assign a dog for training.");
    }
    throw new Error(
      `Trainer at capacity (${capacity.currentCount}/${capacity.maxCount})`
    );
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
    type: "training" | "class";
  }[]
) {
  for (const a of assignments) {
    const parsed = assignmentSchema.parse(a);
    const weekStart = fromDateString(parsed.weekStartDate);

    const capacity = await validateTrainerCapacity(
      parsed.trainerId,
      weekStart,
      parsed.type === "class" ? "class" : "training",
      parsed.dogId // exclude this dog so re-scheduling doesn't double-count
    );
    if (!capacity.valid) {
      if (capacity.maxCount === 0) {
        throw new Error(
          "Trainer is doing class this week; cannot assign a dog for training."
        );
      }
      throw new Error(
        `Trainer at capacity (${capacity.currentCount}/${capacity.maxCount}) for week of ${parsed.weekStartDate}`
      );
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
  }

  const dogIds = [...new Set(assignments.map((a) => a.dogId))];
  for (const dogId of dogIds) {
    await syncDogStatus(dogId);
  }

  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

/**
 * Move a dog to the parking lot for a given week by deleting their assignment.
 * The absence of an assignment means the dog is implicitly in the parking lot.
 */
export async function moveToParkingLot(data: {
  dogId: number;
  weekStartDate: string;
}) {
  const weekStart = fromDateString(data.weekStartDate);

  await prisma.assignment.deleteMany({
    where: {
      dogId: data.dogId,
      weekStartDate: weekStart,
    },
  });

  await syncDogStatus(data.dogId);
  revalidatePath("/forecast");
  revalidatePath("/dogs");
}

export async function syncDogStatus(dogId: number) {
  let dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog || dog.status === "dropout") return;

  const now = new Date();
  const startOfCurrentWeek = getMonday(now);

  // If IFT date is set and in the future, show as Not Yet IFT (e.g. after user edits IFT date)
  if (dog.recallWeekStartDate && dog.recallWeekStartDate > startOfCurrentWeek) {
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: "not_yet_ift" },
    });
    return;
  }

  // Not Yet IFT: once recall week has been reached, fall through to
  // assignment-based status determination below (don't blindly set in_training).
  // Keep recallWeekStartDate so the forecast can show the dog in "Not Yet IFT" for past weeks.
  if (dog.status === "not_yet_ift" && dog.recallWeekStartDate) {
    if (dog.recallWeekStartDate > startOfCurrentWeek) return; // still future, keep not_yet_ift
    // Fall through — the code below will set the correct status based on assignments
  }

  // Check if currently in class (only if today falls within a class period, not future)
  const classAssignment = await prisma.assignment.findFirst({
    where: {
      dogId,
      type: "class",
      weekStartDate: { lte: startOfCurrentWeek },
    },
    orderBy: { weekStartDate: "desc" },
  });

  if (classAssignment) {
    // Graduation happens after the last class week ends (i.e., the following Monday)
    const classEnd = new Date(classAssignment.weekStartDate);
    classEnd.setDate(classEnd.getDate() + 7);

    if (startOfCurrentWeek >= classEnd) {
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

  // Count only past/completed training weeks (cumulative)
  const startOfNextWeek = addWeeks(getMonday(now), 1);
  const completedTrainingWeeks = await prisma.assignment.count({
    where: {
      dogId,
      type: "training",
      weekStartDate: { lt: startOfNextWeek },
    },
  });
  const totalWeeks = completedTrainingWeeks + dog.initialTrainingWeeks;

  // Dog with no training assignments: if they already have enough prior weeks,
  // they should still be class-ready; otherwise keep paused.
  const hasAnyTrainingAssignment = await prisma.assignment.count({
    where: { dogId, type: "training" },
  });
  if (hasAnyTrainingAssignment === 0) {
    if (dog.initialTrainingWeeks >= MIN_TRAINING_WEEKS) {
      await prisma.dog.update({
        where: { id: dogId },
        data: { status: "ready_for_class" },
      });
      return;
    }
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: "paused" },
    });
    return;
  }

  if (totalWeeks >= MIN_TRAINING_WEEKS) {
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: "ready_for_class" },
    });
  } else {
    // Check if dog has a training assignment for the current week.
    // If yes → in_training; if no → paused (started but idle this week).
    const currentWeekTraining = await prisma.assignment.findFirst({
      where: { dogId, type: "training", weekStartDate: startOfCurrentWeek },
    });
    await prisma.dog.update({
      where: { id: dogId },
      data: { status: currentWeekTraining ? "in_training" : "paused" },
    });
  }
}

export async function syncAllDogsStatus() {
  const dogs = await prisma.dog.findMany({ select: { id: true } });
  for (const { id } of dogs) {
    await syncDogStatus(id);
  }
  revalidatePath("/dogs");
  revalidatePath("/forecast");
}
