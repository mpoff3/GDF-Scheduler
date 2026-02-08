import { getTrainers } from "@/queries/trainers";
import { getDogsReadyForClass } from "@/queries/dogs";
import { ClassScheduleForm } from "./class-schedule-form";

export default async function NewClassPage() {
  const [trainers, readyDogs] = await Promise.all([
    getTrainers(),
    getDogsReadyForClass(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Schedule Class</h1>
      <ClassScheduleForm
        trainers={trainers.map((t) => ({ id: t.id, name: t.name }))}
        readyDogs={readyDogs.map((d) => ({
          id: d.id,
          name: d.name,
          trainingWeeks: d.trainingWeeks,
        }))}
      />
    </div>
  );
}
