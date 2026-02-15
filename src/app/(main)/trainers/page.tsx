import Link from "next/link";
import { getTrainers } from "@/queries/trainers";
import { deleteTrainer } from "@/actions/trainers";
import { Button } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function TrainersPage() {
  const trainers = await getTrainers();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Trainers</h1>
        <Button asChild>
          <Link href="/trainers/new">Add Trainer</Link>
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[150px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trainers.map((trainer) => (
            <TableRow key={trainer.id}>
              <TableCell>{trainer.name}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/trainers/${trainer.id}/edit`}>Edit</Link>
                  </Button>
                  <DeleteConfirmDialog
                    title="Delete this trainer?"
                    description="This will permanently remove the trainer. This cannot be undone."
                    action={deleteTrainer}
                    id={trainer.id}
                    trigger={
                      <Button variant="destructive" size="sm">
                        Delete
                      </Button>
                    }
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
          {trainers.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No trainers yet. Add one to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
