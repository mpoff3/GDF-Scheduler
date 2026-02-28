import { getTrainers } from "@/queries/trainers";
import { RecallBatchForm } from "./recall-batch-form";

export default async function RecallPage() {
  const trainers = await getTrainers();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Schedule Recall</h1>
      <RecallBatchForm
        trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
        mode="create"
      />
    </div>
  );
}
