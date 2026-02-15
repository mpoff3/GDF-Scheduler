import { createDog } from "@/actions/dogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function NewDogPage() {
  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Add Dog</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDog} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialTrainingWeeks">Initial Training Weeks</Label>
              <Input
                id="initialTrainingWeeks"
                name="initialTrainingWeeks"
                type="number"
                min={0}
                max={22}
                defaultValue={0}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
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
