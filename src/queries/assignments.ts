import { prisma } from "@/lib/prisma";
import { MAX_TRAINING_DOGS_PER_TRAINER, MAX_CLASS_DOGS_PER_TRAINER } from "@/lib/constants";

export async function getAssignmentsForWeekRange(
  startDate: Date,
  endDate: Date
) {
  return prisma.assignment.findMany({
    where: {
      weekStartDate: { gte: startDate, lt: endDate },
    },
    include: {
      dog: true,
      trainer: true,
    },
    orderBy: { weekStartDate: "asc" },
  });
}

export async function validateTrainerCapacity(
  trainerId: number,
  weekStartDate: Date,
  type: "training" | "class",
  excludeDogId?: number
): Promise<{ valid: boolean; currentCount: number; maxCount: number }> {
  const maxCount =
    type === "training" ? MAX_TRAINING_DOGS_PER_TRAINER : MAX_CLASS_DOGS_PER_TRAINER;

  // Check if trainer has a class assignment this week
  if (type === "training") {
    const classAssignment = await prisma.assignment.findFirst({
      where: {
        trainerId,
        weekStartDate,
        type: "class",
      },
    });
    if (classAssignment) {
      return { valid: false, currentCount: 0, maxCount: 0 };
    }
  }

  const where: Record<string, unknown> = {
    trainerId,
    weekStartDate,
    type,
  };
  if (excludeDogId) {
    where.dogId = { not: excludeDogId };
  }

  const currentCount = await prisma.assignment.count({ where });

  return {
    valid: currentCount < maxCount,
    currentCount,
    maxCount,
  };
}

export async function getTrainerAssignmentsForWeek(
  trainerId: number,
  weekStartDate: Date
) {
  return prisma.assignment.findMany({
    where: { trainerId, weekStartDate },
    include: { dog: true },
  });
}
