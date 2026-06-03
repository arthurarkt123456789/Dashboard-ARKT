CREATE TABLE "LedgerEntryCache" (
    "invoiceId"   BIGINT NOT NULL,
    "accountCode" TEXT,
    "fetchedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntryCache_pkey" PRIMARY KEY ("invoiceId")
);
