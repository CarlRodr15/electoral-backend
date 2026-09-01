-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "telefono" TEXT,
    "rol" TEXT NOT NULL,
    "contrasena" TEXT NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Simpatizante" (
    "id" SERIAL NOT NULL,
    "nombreCompleto" TEXT NOT NULL,
    "cedula" TEXT NOT NULL,
    "telefono" TEXT,
    "direccion" TEXT,
    "apoyaAlcaldia" BOOLEAN NOT NULL DEFAULT false,
    "apoyaConcejo" BOOLEAN NOT NULL DEFAULT false,
    "liderId" INTEGER NOT NULL,
    "territorioId" INTEGER,
    "puestoVotacionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Simpatizante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territorio" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,

    CONSTRAINT "Territorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuestoVotacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "mesas" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "PuestoVotacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_cedula_key" ON "Usuario"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "Simpatizante_cedula_key" ON "Simpatizante"("cedula");

-- AddForeignKey
ALTER TABLE "Simpatizante" ADD CONSTRAINT "Simpatizante_liderId_fkey" FOREIGN KEY ("liderId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simpatizante" ADD CONSTRAINT "Simpatizante_territorioId_fkey" FOREIGN KEY ("territorioId") REFERENCES "Territorio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Simpatizante" ADD CONSTRAINT "Simpatizante_puestoVotacionId_fkey" FOREIGN KEY ("puestoVotacionId") REFERENCES "PuestoVotacion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
