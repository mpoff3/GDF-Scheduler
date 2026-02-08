import { prisma } from "@/lib/prisma";

export async function getClasses() {
  return prisma.class.findMany({
    orderBy: { startDate: "desc" },
    include: {
      classAssignments: {
        include: {
          trainer: true,
          dog: true,
        },
      },
    },
  });
}

export async function getClassById(id: number) {
  return prisma.class.findUnique({
    where: { id },
    include: {
      classAssignments: {
        include: {
          trainer: true,
          dog: true,
        },
      },
    },
  });
}
