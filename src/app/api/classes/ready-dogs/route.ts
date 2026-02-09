import { NextRequest, NextResponse } from "next/server";
import { getDogsReadyForClass } from "@/queries/dogs";
import { fromDateString } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("startDate");
  if (!startDate) {
    return NextResponse.json(
      { error: "startDate query parameter is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  const asOf = fromDateString(startDate);
  const dogs = await getDogsReadyForClass(asOf);
  return NextResponse.json(
    dogs.map((d) => ({ id: d.id, name: d.name, trainingWeeks: d.trainingWeeks }))
  );
}
