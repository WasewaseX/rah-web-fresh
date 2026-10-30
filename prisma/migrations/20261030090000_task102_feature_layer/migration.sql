-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diagnosis" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settings" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "skillLevels" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "CardState" ADD COLUMN     "learnerId" TEXT NOT NULL DEFAULT 'me';

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "level" TEXT NOT NULL DEFAULT '?',
ADD COLUMN     "skill" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "title" SET DEFAULT '',
ALTER COLUMN "items" SET DEFAULT '';

-- CreateTable
CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "provider" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "discovered" TEXT NOT NULL DEFAULT '',
    "lastTest" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCard" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'cloze',
    "prompt" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "en" TEXT NOT NULL DEFAULT '',
    "fa" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'B2',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorReport" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRun" (
    "id" SERIAL NOT NULL,
    "kind" TEXT NOT NULL DEFAULT '',
    "length" INTEGER NOT NULL DEFAULT 0,
    "items" TEXT NOT NULL DEFAULT '',
    "exam" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ready',
    "score" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "percent" INTEGER NOT NULL DEFAULT -1,
    "band" TEXT NOT NULL DEFAULT '',
    "report" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT '',
    "answers" TEXT NOT NULL DEFAULT '',
    "elapsedMs" INTEGER NOT NULL DEFAULT 0,
    "spec" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpeakingAttempt" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "promptId" TEXT NOT NULL,
    "attemptNo" INTEGER NOT NULL DEFAULT 1,
    "seconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "selfEval" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeakingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagOverride" (
    "tag" TEXT NOT NULL,
    "stance" TEXT NOT NULL,

    CONSTRAINT "TagOverride_pkey" PRIMARY KEY ("tag")
);

-- CreateTable
CREATE TABLE "Checkpoint" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "listeningPct" INTEGER NOT NULL DEFAULT 0,
    "readingScore" INTEGER NOT NULL DEFAULT 0,
    "writingText" TEXT NOT NULL DEFAULT '',
    "speakingNotes" TEXT NOT NULL DEFAULT '',
    "day" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Checkpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrammarDone" (
    "learnerId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrammarDone_pkey" PRIMARY KEY ("learnerId","lessonId")
);

-- CreateTable
CREATE TABLE "ListeningLog" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "passageId" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "missType" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListeningLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacementResult" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'B2',
    "strands" TEXT NOT NULL DEFAULT '{}',
    "day" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlacementResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 0,
    "strand" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "meta" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SoundLog" (
    "id" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "pairId" TEXT NOT NULL,
    "focus" TEXT NOT NULL DEFAULT '',
    "correct" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SoundLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillBand" (
    "band" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '?',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillBand_pkey" PRIMARY KEY ("band")
);

-- CreateIndex
CREATE INDEX "UserCard_learnerId_createdAt_idx" ON "UserCard"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "TutorReport_kind_at_idx" ON "TutorReport"("kind", "at");

-- CreateIndex
CREATE INDEX "SpeakingAttempt_learnerId_promptId_idx" ON "SpeakingAttempt"("learnerId", "promptId");

-- CreateIndex
CREATE INDEX "Checkpoint_learnerId_createdAt_idx" ON "Checkpoint"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "ListeningLog_learnerId_createdAt_idx" ON "ListeningLog"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "PlacementResult_learnerId_createdAt_idx" ON "PlacementResult"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionLog_learnerId_day_idx" ON "SessionLog"("learnerId", "day");

-- CreateIndex
CREATE INDEX "SoundLog_learnerId_createdAt_idx" ON "SoundLog"("learnerId", "createdAt");

-- CreateIndex
CREATE INDEX "CardState_learnerId_due_idx" ON "CardState"("learnerId", "due");

-- AddForeignKey
ALTER TABLE "UserCard" ADD CONSTRAINT "UserCard_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpeakingAttempt" ADD CONSTRAINT "SpeakingAttempt_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkpoint" ADD CONSTRAINT "Checkpoint_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrammarDone" ADD CONSTRAINT "GrammarDone_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListeningLog" ADD CONSTRAINT "ListeningLog_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacementResult" ADD CONSTRAINT "PlacementResult_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoundLog" ADD CONSTRAINT "SoundLog_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "Learner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

