import Link from "next/link";
import { getRecallEvents } from "@/queries/dogs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteRecallButton } from "./_components/delete-recall-button";

export default async function RecallsPage() {
  const events = await getRecallEvents();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Recalls</h1>
        <Button asChild>
          <Link href="/dogs/recall" target="_blank" rel="noopener noreferrer">
            Schedule Recall
          </Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground">No recall events scheduled yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => {
            const startDate = new Date(event.weekStartDate + "T00:00:00Z").toLocaleDateString(
              "en-US",
              {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              }
            );
            return (
              <Card key={event.weekStartDate}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg">Recall — {startDate}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/recalls/${event.weekStartDate}/edit`}>
                        Edit
                      </Link>
                    </Button>
                    <DeleteRecallButton
                      weekStartDate={event.weekStartDate}
                      displayDate={startDate}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {event.dogs.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">
                        No dogs in this recall
                      </p>
                    ) : (
                      event.dogs.map((d) => (
                        <div key={d.id} className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            {d.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {d.trainerName ? `with ${d.trainerName}` : "no trainer"}
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
