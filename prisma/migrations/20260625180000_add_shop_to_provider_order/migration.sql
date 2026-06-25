-- AlterTable: add shop column to ProviderOrder
ALTER TABLE "ProviderOrder" ADD COLUMN "shop" TEXT NOT NULL DEFAULT '';
