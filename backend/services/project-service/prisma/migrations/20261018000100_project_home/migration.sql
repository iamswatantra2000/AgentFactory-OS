ALTER TABLE "Project" ADD COLUMN "ownerId" UUID;
ALTER TABLE "Project" ADD COLUMN "outcome" TEXT;
ALTER TABLE "Project" ADD COLUMN "teamName" TEXT;
ALTER TABLE "Project" ADD COLUMN "startingPoint" TEXT NOT NULL DEFAULT 'blank';
ALTER TABLE "Project" ADD COLUMN "templateKey" TEXT;
ALTER TABLE "Project" ADD COLUMN "lastOpenedAt" TIMESTAMP(3);
ALTER TABLE "Project" ALTER COLUMN "status" SET DEFAULT 'preparing';

CREATE TABLE "ProjectMember" (
  "projectId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" TEXT NOT NULL,
  CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("projectId", "userId")
);
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
