import { getTrainers } from "@/queries/trainers";
import { RecallForm } from "./recall-form";

export default async function RecallPage() {
  const trainers = await getTrainers();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Schedule Recall</h1>
      <RecallForm trainers={trainers.map((t) => ({ id: t.id, name: t.name }))} />
    </div>
  );
}
