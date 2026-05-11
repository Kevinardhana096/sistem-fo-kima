-- AlterTable: add password_plain to isps for admin display
ALTER TABLE "isps" ADD COLUMN "password_plain" VARCHAR(255);
