import { getForecastData } from "@/queries/forecast";
import { getMonday } from "@/lib/dates";
import { ForecastGrid } from "./_components/forecast-grid";

export const dynamic = "force-dynamic";

export default async function ForecastPage() {
  const startDate = getMonday(new Date());
  const initialData = await getForecastData(startDate, 12);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Forecast</h1>
      </div>
      <ForecastGrid
        initialData={initialData}
        initialStartDate={startDate.toISOString()}
      />
    </div>
  );
}
