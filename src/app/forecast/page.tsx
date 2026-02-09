import Link from "next/link";
import { getForecastData } from "@/queries/forecast";
import { getMonday, addWeeks } from "@/lib/dates";
import { ForecastGrid } from "./_components/forecast-grid";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const today = getMonday(new Date());
  // Load 8 weeks in the past + 18 weeks ahead = 26 weeks for initial scrollable view
  const startDate = addWeeks(today, -8);
  const initialData = await getForecastData(startDate, 26);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link href="/dogs/recall" target="_blank" rel="noopener noreferrer">Schedule Recall</Link>
          </Button>
          <Button asChild>
            <Link href="/classes/new" target="_blank" rel="noopener noreferrer">Schedule Class</Link>
          </Button>
        </div>
      </div>
      <ForecastGrid initialData={initialData} />
    </div>
  );
}
