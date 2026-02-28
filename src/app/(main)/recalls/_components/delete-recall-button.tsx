"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteRecallEvent } from "@/actions/dogs";

export function DeleteRecallButton({
  weekStartDate,
  displayDate,
}: {
  weekStartDate: string;
  displayDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  async function handleConfirm() {
    setIsDeleting(true);
    try {
      await deleteRecallEvent(weekStartDate);
      setOpen(false);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={true}>
        <DialogHeader>
          <DialogTitle>Delete recall?</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the recall for {displayDate}? All
            dogs in this recall will be removed and their assignments from that
            week onward will be cleared. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter showCloseButton={false}>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
