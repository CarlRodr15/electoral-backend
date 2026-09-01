const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('⏳ Creando usuario Administrador Maestro...');

  // Encriptamos la contraseña para que el login la acepte
  const salt = await bcrypt.genSalt(10);
  const contrasenaEncriptada = await bcrypt.hash('admin1234', salt); // Contraseña provisional

  // Insertamos el usuario a la fuerza en la base de datos
  const admin = await prisma.usuario.upsert({
    where: { cedula: '1006208101' }, // Reemplaza con tu cédula si lo deseas
    update: {},
    create: {
      nombre: 'Carlos Andres Rodriguez Benjumea',
      cedula: '1006208101', 
      telefono: '3000000000',
      rol: 'ADMIN',
      contrasena: contrasenaEncriptada
    }
  });

  console.log(`✅ ¡Administrador creado con éxito!`);
  console.log(`👤 Nombre: ${admin.nombre}`);
  console.log(`💳 Cédula: ${admin.cedula}`);
  console.log(`🔑 Contraseña: admin1234`);
}

main()
  .catch((e) => {
    console.error('❌ Error al crear el Admin:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });