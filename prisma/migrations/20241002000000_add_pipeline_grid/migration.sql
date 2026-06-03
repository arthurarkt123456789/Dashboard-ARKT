-- CreateTable
CREATE TABLE "PipelineMonthEntry" (
    "id" SERIAL NOT NULL,
    "clientName" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineMonthEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PipelineMonthEntry_clientName_month_key" ON "PipelineMonthEntry"("clientName", "month");
