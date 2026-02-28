"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RecalculateStatusButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      variant="outline"
      size="sm"
      type="submit"
      disabled={pending}
      className="h-6 px-2 text-xs shrink-0"
    >
      {pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        "(Recalculate)"
      )}
    </Button>
  );
}
