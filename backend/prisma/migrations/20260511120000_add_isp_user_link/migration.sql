-- AlterTable: add user_id FK to isps
ALTER TABLE "isps" ADD COLUMN "user_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "isps_user_id_key" ON "isps"("user_id");

-- AddForeignKey
ALTER TABLE "isps" ADD CONSTRAINT "isps_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
