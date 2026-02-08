import { prisma } from "@/lib/prisma";

export async function getDogs() {
  return prisma.dog.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getDogById(id: number) {
  return prisma.dog.findUnique({ where: { id } });
}

export async function getDogTrainingWeeks(dogId: number): Promise<number> {
  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog) return 0;

  const trainingAssignments = await prisma.assignment.count({
    where: { dogId, type: "training" },
  });

  return trainingAssignments + dog.initialTrainingWeeks;
}

export async function getDogsReadyForClass() {
  const dogs = await prisma.dog.findMany({
    where: {
      status: { in: ["in_training", "ready_for_class"] },
    },
    include: {
      assignments: {
        where: { type: "training" },
      },
    },
  });

  return dogs
    .map((dog) => ({
      ...dog,
      trainingWeeks: dog.assignments.length + dog.initialTrainingWeeks,
    }))
    .filter((dog) => dog.trainingWeeks >= 14);
}
