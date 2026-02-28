import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecallEventByWeekStart } from "@/queries/dogs";
import { getTrainers } from "@/queries/trainers";
import { RecallBatchForm } from "@/app/(main)/dogs/recall/recall-batch-form";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ weekStart: string }> };

export default async function EditRecallPage({ params }: Props) {
  const { weekStart } = await params;
  const event = await getRecallEventByWeekStart(weekStart);
  if (!event) notFound();

  const trainers = await getTrainers();

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/recalls">← Back to Recalls</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-6">Edit Recall</h1>
      <RecallBatchForm
        trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
        mode="edit"
        existingEvent={event}
      />
    </div>
  );
}
