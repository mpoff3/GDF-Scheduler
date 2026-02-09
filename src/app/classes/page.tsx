import Link from "next/link";
import { getClasses } from "@/queries/classes";
import { deleteClass } from "@/actions/classes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClassesPage() {
  const classes = await getClasses();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Button asChild>
          <Link href="/classes/new" target="_blank" rel="noopener noreferrer">Schedule Class</Link>
        </Button>
      </div>

      {classes.length === 0 ? (
        <p className="text-muted-foreground">No classes scheduled yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => {
            const startDate = new Date(cls.startDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              timeZone: "UTC",
            });
            return (
              <Card key={cls.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">
                    Class — {startDate}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/classes/${cls.id}/edit`}>Edit</Link>
                    </Button>
                    <form
                      action={async () => {
                        "use server";
                        await deleteClass(cls.id);
                      }}
                    >
                      <Button variant="destructive" size="sm" type="submit">
                        Delete
                      </Button>
                    </form>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cls.classAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No dogs or trainers assigned yet
                      </p>
                    ) : (
                      cls.classAssignments.map((ca) => (
                        <div key={ca.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            {ca.dog.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            with {ca.trainer.name}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
