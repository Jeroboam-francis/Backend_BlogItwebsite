/*
  Warnings:

  - A unique constraint covering the columns `[secondary_email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "secondary_email" TEXT,
ADD COLUMN     "status_text" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_secondary_email_key" ON "users"("secondary_email");
