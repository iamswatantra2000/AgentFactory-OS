ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE "AuthToken" (
  "tokenHash" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "purpose" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("tokenHash")
);
CREATE INDEX "AuthToken_userId_purpose_idx" ON "AuthToken"("userId", "purpose");
CREATE INDEX "AuthToken_expiresAt_idx" ON "AuthToken"("expiresAt");
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ExternalIdentity" (
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("provider", "subject")
);
CREATE UNIQUE INDEX "ExternalIdentity_userId_provider_key" ON "ExternalIdentity"("userId", "provider");
ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "OAuthAttempt" (
  "stateHash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OAuthAttempt_pkey" PRIMARY KEY ("stateHash")
);
CREATE INDEX "OAuthAttempt_expiresAt_idx" ON "OAuthAttempt"("expiresAt");
