import Link from "next/link";
import { Suspense } from "react";
import { getDogs } from "@/queries/dogs";
import { deleteDog, markDogDropout, reenrollDog } from "@/actions/dogs";
import { syncAllDogsStatus } from "@/actions/assignments";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import { StatusBadge } from "./_components/status-badge";
import { RecalculateStatusButton } from "./_components/recalculate-status-button";
import { DogsFilters } from "./_components/dogs-filters";

export default async function DogsPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; status?: string }>;
}) {
  const { name, status } = await searchParams;
  const allDogs = await getDogs();

  const dogs = allDogs.filter((dog) => {
    const matchesName = !name || dog.name.toLowerCase().includes(name.toLowerCase());
    const matchesStatus = !status || status === "all" || dog.status === status;
    return matchesName && matchesStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dogs</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dogs/recall" target="_blank" rel="noopener noreferrer">Schedule Recall</Link>
          </Button>
          <Button asChild>
            <Link href="/dogs/new">Add Dog</Link>
          </Button>
        </div>
      </div>

      <Suspense>
        <DogsFilters />
      </Suspense>

      <div className="max-h-[calc(100vh-12rem)] overflow-y-auto rounded-md border">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b">
              <th className="sticky top-0 z-10 bg-background h-10 px-2 text-left align-middle font-medium whitespace-nowrap shadow-[0_1px_0_0_hsl(var(--border))]">Name</th>
              <th className="sticky top-0 z-10 bg-background h-10 px-2 text-left align-middle font-medium whitespace-nowrap shadow-[0_1px_0_0_hsl(var(--border))]">
                <span className="inline-flex items-center gap-1">
                  Status{" "}
                  <form action={syncAllDogsStatus} className="inline">
                    <RecalculateStatusButton />
                  </form>
                </span>
              </th>
              <th className="sticky top-0 z-10 bg-background h-10 px-2 text-left align-middle font-medium whitespace-nowrap shadow-[0_1px_0_0_hsl(var(--border))]">Cumulative Training Weeks</th>
              <th className="sticky top-0 z-10 bg-background h-10 px-2 text-left align-middle font-medium whitespace-nowrap w-[250px] shadow-[0_1px_0_0_hsl(var(--border))]">Actions</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {dogs.map((dog) => (
              <tr key={dog.id} className="hover:bg-muted/50 border-b transition-colors">
                <td className="p-2 align-middle whitespace-nowrap">{dog.name}</td>
                <td className="p-2 align-middle whitespace-nowrap">
                  <StatusBadge
                    status={dog.status}
                    recallWeekStartDate={dog.recallWeekStartDate}
                  />
                </td>
                <td className="p-2 align-middle whitespace-nowrap">{dog.cumulativeTrainingWeeks}</td>
                <td className="p-2 align-middle whitespace-nowrap">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dogs/${dog.id}/edit`}>Edit</Link>
                    </Button>
                    {dog.status === "dropout" && (
                      <form
                        action={async () => {
                          "use server";
                          await reenrollDog(dog.id);
                        }}
                      >
                        <Button variant="secondary" size="sm" type="submit">
                          Reenroll
                        </Button>
                      </form>
                    )}
                    {dog.status !== "dropout" && dog.status !== "graduated" && (
                      <form
                        action={async () => {
                          "use server";
                          await markDogDropout(dog.id);
                        }}
                      >
                        <Button variant="secondary" size="sm" type="submit">
                          Dropout
                        </Button>
                      </form>
                    )}
                    <DeleteConfirmDialog
                      title="Delete this dog?"
                      description="This will permanently remove the dog and their assignment history. This cannot be undone."
                      action={deleteDog}
                      id={dog.id}
                      trigger={
                        <Button variant="destructive" size="sm">
                          Delete
                        </Button>
                      }
                    />
                  </div>
                </td>
              </tr>
            ))}
            {dogs.length === 0 && (
              <tr>
                <td colSpan={4} className="p-2 text-center text-muted-foreground">
                  {name || (status && status !== "all")
                    ? "No dogs match your search."
                    : "No dogs yet. Add one or schedule a recall."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
