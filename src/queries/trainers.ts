import { prisma } from "@/lib/prisma";

export async function getTrainers() {
  return prisma.trainer.findMany({
    orderBy: { name: "asc" },
  });
}

export async function getTrainerById(id: number) {
  return prisma.trainer.findUnique({ where: { id } });
}
