import { NextRequest, NextResponse } from "next/server";
import { getForecastData } from "@/queries/forecast";
import { fromDateString } from "@/lib/dates";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const startDate = searchParams.get("startDate");
  const weekCount = searchParams.get("weekCount");

  if (!startDate || !weekCount) {
    return NextResponse.json(
      { error: "startDate and weekCount are required" },
      { status: 400 }
    );
  }

  const data = await getForecastData(
    fromDateString(startDate),
    parseInt(weekCount, 10)
  );

  return NextResponse.json(data);
}
