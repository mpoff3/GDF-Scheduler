"use client";

import { RecallBatchForm } from "./recall-batch-form";

export function RecallForm({
  trainers,
}: {
  trainers: { id: number; name: string }[];
}) {
  return <RecallBatchForm trainers={trainers} mode="create" />;
}
