-- CreateTable
CREATE TABLE "public"."RepoInstallation" (
    "id" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "repo" TEXT NOT NULL,
    "installationId" BIGINT NOT NULL,
    "settingsJson" JSONB,

    CONSTRAINT "RepoInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Issue" (
    "id" TEXT NOT NULL,
    "repoId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" TEXT NOT NULL,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IssueEmbedding" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "vector" DOUBLE PRECISION[],
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TriageSuggestion" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "labels" TEXT[],
    "assignees" TEXT[],
    "priorityScore" INTEGER NOT NULL,
    "duplicateOf" INTEGER,
    "confidenceJson" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TriageSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DecisionLog" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SimilarLink" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "similarIssueId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SimilarLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoutingMap" (
    "id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "teamSlug" TEXT NOT NULL,
    "codeownersPaths" TEXT[],

    CONSTRAINT "RoutingMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MetricsDaily" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "repoId" TEXT NOT NULL,
    "suggestions" INTEGER NOT NULL DEFAULT 0,
    "accepted" INTEGER NOT NULL DEFAULT 0,
    "autoApplied" INTEGER NOT NULL DEFAULT 0,
    "dupesClosed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MetricsDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RepoInstallation_owner_repo_key" ON "public"."RepoInstallation"("owner", "repo");

-- CreateIndex
CREATE UNIQUE INDEX "Issue_repoId_number_key" ON "public"."Issue"("repoId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MetricsDaily_date_repoId_key" ON "public"."MetricsDaily"("date", "repoId");

-- AddForeignKey
ALTER TABLE "public"."Issue" ADD CONSTRAINT "Issue_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "public"."RepoInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."IssueEmbedding" ADD CONSTRAINT "IssueEmbedding_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TriageSuggestion" ADD CONSTRAINT "TriageSuggestion_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DecisionLog" ADD CONSTRAINT "DecisionLog_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimilarLink" ADD CONSTRAINT "SimilarLink_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SimilarLink" ADD CONSTRAINT "SimilarLink_similarIssueId_fkey" FOREIGN KEY ("similarIssueId") REFERENCES "public"."Issue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MetricsDaily" ADD CONSTRAINT "MetricsDaily_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "public"."RepoInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
