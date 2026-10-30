-- AlterTable
ALTER TABLE "CardState" ADD COLUMN     "learnerId" TEXT NOT NULL DEFAULT 'me';

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "gradedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "diagnosis" TEXT NOT NULL DEFAULT '{}',
ADD COLUMN     "onboarded" BOOLEAN NOT NULL DEFAULT false;

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

-- DropForeignKey
ALTER TABLE "MaterialCard" DROP CONSTRAINT "MaterialCard_materialId_fkey";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ExamRun" ADD COLUMN     "answers" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "elapsedMs" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "settings" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "SkillLevel" ADD COLUMN     "band" TEXT NOT NULL,
ADD COLUMN     "evidence" TEXT NOT NULL DEFAULT '';

-- DropTable
DROP TABLE "Achievement";

-- DropTable
DROP TABLE "Briefing";

-- DropTable
DROP TABLE "ContentFlag";

-- DropTable
DROP TABLE "GameStat";

-- DropTable
DROP TABLE "Goal";

-- DropTable
DROP TABLE "League";

-- DropTable
DROP TABLE "Material";

-- DropTable
DROP TABLE "MaterialCard";

-- DropTable
DROP TABLE "MistakeFamily";

-- DropTable
DROP TABLE "MistakeForgiven";

-- DropTable
DROP TABLE "Quest";

-- DropTable
DROP TABLE "Rival";

-- DropTable
DROP TABLE "RunState";

-- DropTable
DROP TABLE "TagMastery";

-- CreateIndex
CREATE UNIQUE INDEX "SkillLevel_band_key" ON "SkillLevel"("band");

-- CreateTable
CREATE TABLE "Achievement" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "GameStat" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "key" TEXT NOT NULL,
    "best" INTEGER NOT NULL DEFAULT 0,
    "plays" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameStat_pkey" PRIMARY KEY ("userId","key")
);

-- CreateTable
CREATE TABLE "Quest" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fa" TEXT NOT NULL DEFAULT '',
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "Rival" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekXp" INTEGER NOT NULL DEFAULT 0,
    "lastWeekXp" INTEGER NOT NULL DEFAULT 0,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "taunt" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Rival_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "League" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "weekKey" INTEGER NOT NULL DEFAULT -1,
    "division" INTEGER NOT NULL DEFAULT 0,
    "history" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "League_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "RunState" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "id" TEXT NOT NULL,
    "day" INTEGER NOT NULL DEFAULT 0,
    "state" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunState_pkey" PRIMARY KEY ("userId","id")
);

-- CreateTable
CREATE TABLE "Briefing" (
    "day" INTEGER NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Briefing_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "MistakeFamily" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "evidence" TEXT NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "editedAt" TIMESTAMP(3),
    "streakClean" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "MistakeFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagMastery" (
    "userId" TEXT NOT NULL DEFAULT 'me',
    "tag" TEXT NOT NULL,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "no" INTEGER NOT NULL DEFAULT 0,
    "ewma" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "lastOk" TIMESTAMP(3),
    "lastNo" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TagMastery_pkey" PRIMARY KEY ("userId","tag")
);

-- CreateTable
CREATE TABLE "MistakeForgiven" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "kind" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "evidenceHash" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MistakeForgiven_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'habit',
    "target" TEXT NOT NULL DEFAULT '',
    "dueDay" INTEGER,
    "weeklySessions" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentFlag" (
    "id" SERIAL NOT NULL,
    "cardId" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'other',
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'me',
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "words" INTEGER NOT NULL DEFAULT 0,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCard" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MistakeFamily_userId_resolvedAt_idx" ON "MistakeFamily"("userId", "resolvedAt");

-- CreateIndex
CREATE INDEX "MistakeFamily_userId_lastSeen_idx" ON "MistakeFamily"("userId", "lastSeen");

-- CreateIndex
CREATE INDEX "MistakeForgiven_userId_idx" ON "MistakeForgiven"("userId");

-- CreateIndex
CREATE INDEX "Goal_userId_archivedAt_idx" ON "Goal"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "Material_userId_idx" ON "Material"("userId");

-- CreateIndex
CREATE INDEX "MaterialCard_materialId_idx" ON "MaterialCard"("materialId");

-- AddForeignKey
ALTER TABLE "MaterialCard" ADD CONSTRAINT "MaterialCard_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropIndex
DROP INDEX "SkillLevel_band_key";

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "skill" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Learner" ADD COLUMN     "skillLevels" TEXT NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "SkillLevel" DROP COLUMN "band",
DROP COLUMN "evidence";

-- CreateTable
CREATE TABLE "SkillBand" (
    "band" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT '?',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidence" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillBand_pkey" PRIMARY KEY ("band")
);

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN     "level" TEXT NOT NULL DEFAULT '?';

-- AlterTable
ALTER TABLE "ExamRun" ADD COLUMN     "at" TIMESTAMP(3),
ADD COLUMN     "spec" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Exam" ALTER COLUMN "title" SET DEFAULT '',
ALTER COLUMN "items" SET DEFAULT '';

-- AlterTable
ALTER TABLE "ExamRun" ALTER COLUMN "at" SET NOT NULL,
ALTER COLUMN "at" SET DEFAULT CURRENT_TIMESTAMP;

-- This is an empty migration.

