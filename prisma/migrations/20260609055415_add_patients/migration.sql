-- CreateTable
CREATE TABLE "Patient" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "customerId" TEXT,
    "patientName" TEXT NOT NULL,
    "email" TEXT,
    "dob" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "patientIdentifier" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ProviderOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shopifyOrderId" TEXT NOT NULL,
    "patientIdentifier" TEXT NOT NULL,
    "providerOrderId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Patient_patientIdentifier_key" ON "Patient"("patientIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_shop_customerId_patientName_dob_gender_key" ON "Patient"("shop", "customerId", "patientName", "dob", "gender");
