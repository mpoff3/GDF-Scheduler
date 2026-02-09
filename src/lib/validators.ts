import { z } from "zod";

export const trainerSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

const optionalDateString = z
  .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")])
  .optional()
  .transform((s) => (s === "" || s === undefined ? null : s));

export const dogSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  initialTrainingWeeks: z.coerce.number().int().min(0).max(22).default(0),
  recallWeekStartDate: optionalDateString,
});

export const assignmentSchema = z.object({
  dogId: z.coerce.number().int().positive(),
  trainerId: z.coerce.number().int().positive(),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["training", "class"]),
});

export const recallSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dogs: z.array(
    z.object({
      name: z.string().min(1, "Name is required"),
      trainerId: z.coerce.number().int().min(0), // 0 = "idk yet" → dog created as paused, no assignment
      initialTrainingWeeks: z.coerce.number().int().min(0).max(22).default(0),
    })
  ).min(1, "At least one dog is required"),
});

export const classScheduleSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assignments: z.array(
    z.object({
      dogId: z.coerce.number().int().positive(),
      trainerId: z.coerce.number().int().positive(),
    })
  ).min(1, "At least one dog-trainer pair is required"),
});
