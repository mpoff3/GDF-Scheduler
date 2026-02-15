import { notFound } from "next/navigation";
import { getTrainerById } from "@/queries/trainers";
import { updateTrainer } from "@/actions/trainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function EditTrainerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trainer = await getTrainerById(Number(id));
  if (!trainer) notFound();

  const updateWithId = updateTrainer.bind(null, trainer.id);

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Edit Trainer</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateWithId} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={trainer.name} required />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button variant="outline" asChild>
                <Link href="/trainers">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
