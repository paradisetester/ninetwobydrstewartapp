-- CreateTable
CREATE TABLE "AppSetting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "patientIdPrefix" TEXT NOT NULL DEFAULT '',
    "patientIdDigits" INTEGER NOT NULL DEFAULT 10,
    "patientIdSequence" BIGINT NOT NULL DEFAULT 9200000001,
    "apiEndpoint" TEXT,
    "apiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSetting_shop_key" ON "AppSetting"("shop");
