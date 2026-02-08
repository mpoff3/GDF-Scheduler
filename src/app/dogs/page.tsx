import Link from "next/link";
import { getDogs } from "@/queries/dogs";
import { deleteDog, markDogDropout } from "@/actions/dogs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusColors: Record<string, string> = {
  in_training: "bg-blue-100 text-blue-800",
  ready_for_class: "bg-yellow-100 text-yellow-800",
  in_class: "bg-green-100 text-green-800",
  graduated: "bg-emerald-100 text-emerald-800",
  dropout: "bg-red-100 text-red-800",
};

export default async function DogsPage() {
  const dogs = await getDogs();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dogs</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dogs/recall">Schedule Recall</Link>
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
            <TableHead>Initial Training Weeks</TableHead>
            <TableHead className="w-[250px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dogs.map((dog) => (
            <TableRow key={dog.id}>
              <TableCell>{dog.name}</TableCell>
              <TableCell>
                <Badge className={statusColors[dog.status] || ""} variant="outline">
                  {dog.status.replace(/_/g, " ")}
                </Badge>
              </TableCell>
              <TableCell>{dog.initialTrainingWeeks}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dogs/${dog.id}/edit`}>Edit</Link>
                  </Button>
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
