import Link from "next/link";
import { getClasses } from "@/queries/classes";
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
          <Link href="/classes/new">Schedule Class</Link>
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
            });
            return (
              <Card key={cls.id}>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Class — {startDate}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {cls.classAssignments.map((ca) => (
                      <div key={ca.id} className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-100 text-green-800">
                          {ca.dog.name}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          with {ca.trainer.name}
                        </span>
                      </div>
                    ))}
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
