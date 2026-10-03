-- Hand-written migration (PRD section 8.2). Prisma cannot express these constraints in the schema:
-- if a future generated migration tries to drop them, edit it to keep them.

-- An appointment must end after it starts.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_end_after_start" CHECK ("end_at" > "start_at");

-- Two CONFIRMED appointments can never overlap. '[)' = closed start, open end, so
-- 09:00-09:30 and 09:30-10:00 do not conflict. Cancelled appointments do not hold the slot.
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (tstzrange("start_at", "end_at", '[)') WITH &&)
  WHERE ("status" = 'CONFIRMED');
