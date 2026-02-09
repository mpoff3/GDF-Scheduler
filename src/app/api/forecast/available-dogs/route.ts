import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fromDateString } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const weekDate = searchParams.get("weekDate");

  if (!weekDate) {
    return NextResponse.json({ error: "weekDate required" }, { status: 400 });
  }

  const weekStart = fromDateString(weekDate);

  // Dogs already assigned to a trainer this week (exclude from dropdown); parking lot (trainerId null) dogs are still available
  const assignedToTrainer = await prisma.assignment.findMany({
    where: { weekStartDate: weekStart, trainerId: { not: null } },
    select: { dogId: true },
  });

  const assignedIds = assignedToTrainer.map((a) => a.dogId);

  // Exclude dropout/graduated; exclude "Not Yet IFT" dogs whose recall week is after this week
  const dogs = await prisma.dog.findMany({
    where: {
      status: { notIn: ["dropout", "graduated"] },
      id: { notIn: assignedIds.length > 0 ? assignedIds : [-1] },
      NOT: {
        AND: [
          { status: "not_yet_ift" },
          { recallWeekStartDate: { gt: weekStart } },
        ],
      },
    },
    orderBy: { name: "asc" },
  });

  const dogIds = dogs.map((d) => d.id);

  // Assignments for this week for these dogs (including parking lot) — used to get status for the week
  const assignmentsThisWeek =
    dogIds.length > 0
      ? await prisma.assignment.findMany({
          where: { weekStartDate: weekStart, dogId: { in: dogIds } },
          select: { dogId: true, type: true },
        })
      : [];
  const assignmentByDogId = new Map(
    assignmentsThisWeek.map((a) => [a.dogId, a.type])
  );

  // Find each dog's earliest assignment to know if they've "started" training
  const earliestAssignments =
    dogIds.length > 0
      ? await prisma.assignment.groupBy({
          by: ["dogId"],
          where: { dogId: { in: dogIds } },
          _min: { weekStartDate: true },
        })
      : [];
  const dogStartDate = new Map(
    earliestAssignments
      .filter((ea) => ea._min.weekStartDate)
      .map((ea) => [ea.dogId, ea._min.weekStartDate!])
  );

  return NextResponse.json({
    dogs: dogs.map((d) => {
      // Determine the dog's effective status FOR THIS WEEK (not their current DB status).
      // This mirrors the forecast grid logic.
      const assignmentType = assignmentByDogId.get(d.id);
      let statusForWeek: string;

      if (assignmentType) {
        // Dog has a parking-lot assignment this week — use that type
        statusForWeek = assignmentType; // training | class | paused
      } else if (
        d.status === "not_yet_ift" &&
        d.recallWeekStartDate &&
        weekStart.getTime() < d.recallWeekStartDate.getTime()
      ) {
        // Not-yet-IFT dog whose recall hasn't come yet
        statusForWeek = "not_yet_ift";
      } else {
        // No assignment this week — check if the dog has started (any prior assignment)
        const startDate = dogStartDate.get(d.id);
        if (startDate && startDate.getTime() <= weekStart.getTime()) {
          // Dog has started but has no assignment this week → effectively paused / parking lot
          statusForWeek = "paused";
        } else if (
          d.status === "not_yet_ift" &&
          d.recallWeekStartDate &&
          weekStart.getTime() >= d.recallWeekStartDate.getTime()
        ) {
          // Not-yet-IFT dog whose recall week has arrived but has no assignments yet
          statusForWeek = "in_training";
        } else {
          // Dog hasn't started yet — use current status as fallback
          statusForWeek = d.status;
        }
      }

      return { id: d.id, name: d.name, status: statusForWeek };
    }),
  });
}
