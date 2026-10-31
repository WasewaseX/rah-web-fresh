-- Task 106: record the retrieval direction on every review.
-- The progress view's "accuracy by retrieval direction" chart needs the
-- per-review direction; before this column it only lived on CardState (the
-- LAST direction per card), which cannot answer "which road in is hardest".
-- Historical rows keep '' and are excluded from the chart (honest, not guessed).
ALTER TABLE "ReviewLog" ADD COLUMN "dir" TEXT NOT NULL DEFAULT '';
