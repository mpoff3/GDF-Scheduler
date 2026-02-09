-- 1. Add dropout_date column to dogs
ALTER TABLE "dogs" ADD COLUMN "dropout_date" TIMESTAMP(3);

-- 2. Backfill dropout_date for existing dropout dogs (week after their last assignment)
UPDATE "dogs" d
SET "dropout_date" = sub."dropout_start"
FROM (
  SELECT a."dog_id", MAX(a."week_start_date") + INTERVAL '7 days' AS "dropout_start"
  FROM "assignments" a
  WHERE a."dog_id" IN (SELECT id FROM "dogs" WHERE status = 'dropout')
  GROUP BY a."dog_id"
) sub
WHERE d.id = sub."dog_id"
AND d.status = 'dropout';

-- For dropout dogs with no assignments, use their updated_at as fallback
UPDATE "dogs"
SET "dropout_date" = "updated_at"
WHERE status = 'dropout' AND "dropout_date" IS NULL;

-- 3. Delete all assignments where trainer_id IS NULL (parking lot rows)
DELETE FROM "assignments" WHERE "trainer_id" IS NULL;

-- 4. Delete all assignments where type = 'paused' (legacy paused-with-trainer rows)
DELETE FROM "assignments" WHERE "type" = 'paused';

-- 5. Now safe to make trainer_id NOT NULL
ALTER TABLE "assignments" ALTER COLUMN "trainer_id" SET NOT NULL;
