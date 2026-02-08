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

  // Get dogs not already assigned this week and not dropped out or graduated
  const assignedDogIds = await prisma.assignment.findMany({
    where: { weekStartDate: weekStart },
    select: { dogId: true },
  });

  const assignedIds = assignedDogIds.map((a) => a.dogId);

  const dogs = await prisma.dog.findMany({
    where: {
      status: { notIn: ["dropout", "graduated"] },
      id: { notIn: assignedIds.length > 0 ? assignedIds : [-1] },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    dogs: dogs.map((d) => ({ id: d.id, name: d.name, status: d.status })),
  });
}
