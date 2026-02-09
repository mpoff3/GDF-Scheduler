import Link from "next/link";
import { notFound } from "next/navigation";
import { getClassById } from "@/queries/classes";
import { getTrainers } from "@/queries/trainers";
import { getDogsReadyForClass } from "@/queries/dogs";
import { ClassScheduleForm } from "../../new/class-schedule-form";
import { toDateString } from "@/lib/dates";
import { getMonday } from "@/lib/dates";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export default async function EditClassPage({ params }: Props) {
  const { id } = await params;
  const classId = parseInt(id, 10);
  if (Number.isNaN(classId)) notFound();

  const cls = await getClassById(classId);
  if (!cls) notFound();

  const startDate = getMonday(new Date(cls.startDate));
  const startDateStr = toDateString(startDate);

  const [trainers, readyDogsForDate] = await Promise.all([
    getTrainers(),
    getDogsReadyForClass(startDate),
  ]);

  type ReadyDog = { id: number; name: string; trainingWeeks: number };
  const readyDogIds = new Set(readyDogsForDate.map((d) => d.id));
  const readyDogs: ReadyDog[] = readyDogsForDate.map((d) => ({
    id: d.id,
    name: d.name,
    trainingWeeks: d.trainingWeeks,
  }));
  for (const ca of cls.classAssignments) {
    if (!readyDogIds.has(ca.dog.id)) {
      readyDogIds.add(ca.dog.id);
      readyDogs.push({
        id: ca.dog.id,
        name: ca.dog.name,
        trainingWeeks: 14,
      });
    }
  }

  const existingClass = {
    id: cls.id,
    startDate: startDateStr,
    assignments: cls.classAssignments.map((ca) => ({
      dogId: ca.dogId,
      trainerId: ca.trainerId,
    })),
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/classes">← Back to Classes</Link>
        </Button>
      </div>
      <h1 className="text-2xl font-bold mb-6">Edit Class</h1>
      <ClassScheduleForm
        trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
        readyDogs={readyDogs}
        defaultStartDate={startDateStr}
        existingClass={existingClass}
      />
    </div>
  );
}
