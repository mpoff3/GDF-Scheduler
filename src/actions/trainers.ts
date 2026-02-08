"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { trainerSchema } from "@/lib/validators";

export async function createTrainer(formData: FormData) {
  const parsed = trainerSchema.parse({
    name: formData.get("name"),
  });

  await prisma.trainer.create({ data: { name: parsed.name } });
  revalidatePath("/trainers");
  redirect("/trainers");
}

export async function updateTrainer(id: number, formData: FormData) {
  const parsed = trainerSchema.parse({
    name: formData.get("name"),
  });

  await prisma.trainer.update({
    where: { id },
    data: { name: parsed.name },
  });
  revalidatePath("/trainers");
  redirect("/trainers");
}

export async function deleteTrainer(id: number) {
  await prisma.trainer.delete({ where: { id } });
  revalidatePath("/trainers");
}
