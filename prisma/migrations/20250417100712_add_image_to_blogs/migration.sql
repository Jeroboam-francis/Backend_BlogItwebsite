/*
  Warnings:

  - You are about to drop the column `featuredImage` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `profilePicture` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "users" DROP COLUMN "featuredImage",
DROP COLUMN "profilePicture",
ADD COLUMN     "blogs_images" TEXT,
ADD COLUMN     "featured_image" TEXT,
ADD COLUMN     "profile_pictures" TEXT;
