-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "patientIdPrefix" TEXT NOT NULL DEFAULT '92',
    "patientIdDigits" INTEGER NOT NULL DEFAULT 8,
    "patientIdSequence" BIGINT NOT NULL DEFAULT 1,
    "apiEndpoint" TEXT,
    "apiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AppSetting" ("apiEndpoint", "apiKey", "createdAt", "id", "patientIdDigits", "patientIdPrefix", "patientIdSequence", "shop", "updatedAt") SELECT "apiEndpoint", "apiKey", "createdAt", "id", "patientIdDigits", "patientIdPrefix", "patientIdSequence", "shop", "updatedAt" FROM "AppSetting";
DROP TABLE "AppSetting";
ALTER TABLE "new_AppSetting" RENAME TO "AppSetting";
CREATE UNIQUE INDEX "AppSetting_shop_key" ON "AppSetting"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
