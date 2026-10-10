ALTER TABLE "Conversation" ADD COLUMN "ragMode" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "documentId" TEXT, ADD COLUMN "explanationMode" TEXT NOT NULL DEFAULT 'step_by_step';
CREATE INDEX "Conversation_userId_updatedAt_idx" ON "Conversation"("userId", "updatedAt");
