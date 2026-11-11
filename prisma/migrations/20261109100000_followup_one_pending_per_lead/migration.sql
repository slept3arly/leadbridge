DO $$
DECLARE
  conflicts TEXT;
BEGIN
  SELECT string_agg(
    format('leadId=%s pending_count=%s followUpIds=%s', "leadId", pending_count, follow_up_ids),
    E'\n'
  )
  INTO conflicts
  FROM (
    SELECT
      "leadId",
      count(*) AS pending_count,
      array_agg("id" ORDER BY "createdAt", "id") AS follow_up_ids
    FROM "FollowUp"
    WHERE "status" = 'PENDING'
    GROUP BY "leadId"
    HAVING count(*) > 1
  ) AS duplicate_pending;

  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one pending follow-up per lead. Resolve conflicts explicitly before retrying.'
      USING DETAIL = conflicts;
  END IF;
END $$;

ALTER TABLE "FollowUp" ADD COLUMN "cancelledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "FollowUp_one_pending_per_lead"
ON "FollowUp" ("leadId")
WHERE "status" = 'PENDING';
