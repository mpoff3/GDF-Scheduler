import { createTrainer } from "@/actions/trainers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function NewTrainerPage() {
  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Add Trainer</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createTrainer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
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
