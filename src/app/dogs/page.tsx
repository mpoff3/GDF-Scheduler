import Link from "next/link";
import { getDogs } from "@/queries/dogs";
import { deleteDog, markDogDropout, reenrollDog } from "@/actions/dogs";
import { syncAllDogsStatus } from "@/actions/assignments";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./_components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function DogsPage() {
  const dogs = await getDogs();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dogs</h1>
        <div className="flex gap-2">
          <form action={syncAllDogsStatus}>
            <Button variant="outline" type="submit">
              Recalculate statuses
            </Button>
          </form>
          <Button variant="outline" asChild>
            <Link href="/dogs/recall" target="_blank" rel="noopener noreferrer">Schedule Recall</Link>
          </Button>
          <Button asChild>
            <Link href="/dogs/new">Add Dog</Link>
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cumulative Training Weeks</TableHead>
            <TableHead className="w-[250px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dogs.map((dog) => (
            <TableRow key={dog.id}>
              <TableCell>{dog.name}</TableCell>
              <TableCell>
                <StatusBadge
                  status={dog.status}
                  recallWeekStartDate={dog.recallWeekStartDate}
                />
              </TableCell>
              <TableCell>{dog.cumulativeTrainingWeeks}</TableCell>
              <TableCell>
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
                  <form
                    action={async () => {
                      "use server";
                      await deleteDog(dog.id);
                    }}
                  >
                    <Button variant="destructive" size="sm" type="submit">
                      Delete
                    </Button>
                  </form>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {dogs.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No dogs yet. Add one or schedule a recall.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
