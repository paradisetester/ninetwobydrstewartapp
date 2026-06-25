-- ============================================================
-- Full baseline migration for PostgreSQL
-- Replaces all previous SQLite migrations
-- ============================================================

-- Session table (Shopify auth sessions)
CREATE TABLE "Session" (
    "id"                 TEXT         NOT NULL,
    "shop"               TEXT         NOT NULL,
    "state"              TEXT         NOT NULL,
    "isOnline"           BOOLEAN      NOT NULL DEFAULT false,
    "scope"              TEXT,
    "expires"            TIMESTAMPTZ,
    "accessToken"        TEXT         NOT NULL,
    "userId"             BIGINT,
    "firstName"          TEXT,
    "lastName"           TEXT,
    "email"              TEXT,
    "accountOwner"       BOOLEAN      NOT NULL DEFAULT false,
    "locale"             TEXT,
    "collaborator"       BOOLEAN      DEFAULT false,
    "emailVerified"      BOOLEAN      DEFAULT false,
    "refreshToken"       TEXT,
    "refreshTokenExpires" TIMESTAMPTZ,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- Patient table
CREATE TABLE "Patient" (
    "id"                SERIAL        NOT NULL,
    "shop"              TEXT          NOT NULL,
    "customerId"        TEXT,
    "patientName"       TEXT          NOT NULL,
    "email"             TEXT,
    "dob"               TIMESTAMPTZ   NOT NULL,
    "gender"            TEXT          NOT NULL,
    "patientIdentifier" TEXT          NOT NULL,
    "createdAt"         TIMESTAMPTZ   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Patient_patientIdentifier_key"
    ON "Patient"("patientIdentifier");

CREATE UNIQUE INDEX "Patient_shop_patientName_dob_gender_key"
    ON "Patient"("shop", "patientName", "dob", "gender");

-- ProviderOrder table
CREATE TABLE "ProviderOrder" (
    "id"                SERIAL       NOT NULL,
    "shop"              TEXT         NOT NULL DEFAULT '',
    "shopifyOrderId"    TEXT         NOT NULL,
    "patientIdentifier" TEXT         NOT NULL,
    "providerOrderId"   TEXT,
    "status"            TEXT         NOT NULL,
    "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderOrder_pkey" PRIMARY KEY ("id")
);

-- AppSetting table
CREATE TABLE "AppSetting" (
    "id"                SERIAL       NOT NULL,
    "shop"              TEXT         NOT NULL,
    "patientIdPrefix"   TEXT         NOT NULL DEFAULT '92',
    "patientIdDigits"   INTEGER      NOT NULL DEFAULT 8,
    "patientIdSequence" BIGINT       NOT NULL DEFAULT 1,
    "apiEndpoint"       TEXT,
    "apiKey"            TEXT,
    "createdAt"         TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMPTZ  NOT NULL,
    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_shop_key" ON "AppSetting"("shop");
