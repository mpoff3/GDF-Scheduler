import { notFound } from "next/navigation";
import { getDogById } from "@/queries/dogs";
import { updateDog } from "@/actions/dogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function EditDogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dog = await getDogById(Number(id));
  if (!dog) notFound();

  const updateWithId = updateDog.bind(null, dog.id);

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Edit Dog</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateWithId} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={dog.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialTrainingWeeks">Initial Training Weeks</Label>
              <Input
                id="initialTrainingWeeks"
                name="initialTrainingWeeks"
                type="number"
                min={0}
                max={22}
                defaultValue={dog.initialTrainingWeeks}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button variant="outline" asChild>
                <Link href="/dogs">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
