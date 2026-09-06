/**
 * @fileoverview API RESTful - Backend Principal de Electora
 * @description Sistema de gestión territorial. Maneja la autenticación, base de datos espacial, 
 * jerarquías de campaña (Concejales/Líderes) y auditoría global.
 * @author Carlos Rodriguez - CIO Calima El Darién
 * @version 1.0.0
 */

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

// Inicialización de ORM y Framework
const prisma = new PrismaClient();
const app = express();

// Middlewares Globales
app.use(cors()); // Permite peticiones cruzadas desde el frontend en Vercel
app.use(express.json()); // Parsea los cuerpos de las peticiones a formato JSON

// TODO (Fase 2 SaaS): Pasar esta llave a variables de entorno (.env)
const SECRET_KEY = process.env.JWT_SECRET || "secreto_super_seguro_calima"; 

/* =========================================================================
   1. MÓDULO DE SIMPATIZANTES (PADRÓN ELECTORAL)
   ========================================================================= */

/**
 * @route GET /api/simpatizantes
 * @desc Obtiene todos los simpatizantes registrados con la información de su líder y concejal.
 */
app.get('/api/simpatizantes', async (req, res) => {
  try {
    const simpatizantes = await prisma.simpatizante.findMany({
      include: { lider: { include: { concejal: true } } } 
    });
    res.json(simpatizantes);
  } catch (error) { 
    console.error("[GET Simpatizantes Error]:", error);
    res.status(500).json({ error: 'Error interno en la base de datos' }); 
  }
});

/**
 * @route POST /api/simpatizantes
 * @desc Registra un nuevo simpatizante. Valida que la cédula no esté duplicada.
 */
app.post('/api/simpatizantes', async (req, res) => {
  try {
    // 1. Validación de duplicados
    const existe = await prisma.simpatizante.findFirst({ where: { cedula: req.body.cedula } });
    if (existe) {
      return res.status(400).json({ error: '¡ATENCIÓN! Esta cédula ya se encuentra registrada en el sistema.' });
    }
    // 2. Creación
    const nuevoSimpatizante = await prisma.simpatizante.create({ data: req.body });
    res.status(201).json({ mensaje: '¡Simpatizante guardado!', datos: nuevoSimpatizante });
  } catch (error) { 
    console.error("[POST Simpatizantes Error]:", error);
    res.status(500).json({ error: 'Error interno al guardar simpatizante' }); 
  }
});

/**
 * @route DELETE /api/simpatizantes/:id
 * @desc Elimina un registro de simpatizante por su ID.
 */
app.delete('/api/simpatizantes/:id', async (req, res) => {
  try {
    await prisma.simpatizante.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ mensaje: 'Simpatizante eliminado del sistema' });
  } catch (error) { 
    console.error("[DELETE Simpatizantes Error]:", error);
    res.status(500).json({ error: 'Error al eliminar el registro' }); 
  }
});

/**
 * @route PUT /api/simpatizantes/:id/transferir
 * @desc Reasigna un simpatizante a un nuevo líder (Transferencia de estructura).
 */
app.put('/api/simpatizantes/:id/transferir', async (req, res) => {
  try {
    await prisma.simpatizante.update({
      where: { id: parseInt(req.params.id) },
      data: { liderId: parseInt(req.body.nuevoLiderId) }
    });
    res.json({ mensaje: 'Simpatizante reasignado con éxito' });
  } catch (error) { 
    console.error("[PUT Transferir Error]:", error);
    res.status(500).json({ error: 'Error al reasignar el registro' }); 
  }
});

/**
 * @route PUT /api/simpatizantes/:id
 * @desc Actualiza los campos opcionales del simpatizante (Mesa de votación y observaciones).
 */
app.put('/api/simpatizantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mesa, observaciones } = req.body;
    const simpatizanteActualizado = await prisma.simpatizante.update({
      where: { id: Number(id) },
      data: { mesa, observaciones }
    });
    res.json(simpatizanteActualizado);
  } catch (error) {
    console.error("[PUT Editar Simpatizante Error]:", error);
    res.status(500).json({ error: "Error al actualizar datos adicionales" });
  }
});

/* =========================================================================
   2. MÓDULO DE USUARIOS Y JERARQUÍAS (ADMIN, CONCEJAL, LÍDER)
   ========================================================================= */

/**
 * @route GET /api/usuarios
 * @desc Obtiene la estructura política (Líderes y Concejales). Filtra datos sensibles.
 */
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: { concejal: true, equipoLideres: true }
    });
    // Limpieza de seguridad: Eliminamos el hash de la contraseña antes de enviar al frontend
    const usuariosSeguros = usuarios.map(u => { 
      const { contrasena, ...datosPublicos } = u; 
      return datosPublicos; 
    });
    res.json(usuariosSeguros);
  } catch (error) { 
    console.error("[GET Usuarios Error]:", error);
    res.status(500).json({ error: 'Error al obtener estructura de usuarios' }); 
  }
});

/**
 * @route POST /api/usuarios
 * @desc Crea un nuevo miembro del equipo (Concejal o Líder) con contraseña encriptada.
 */
app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, cedula, telefono, rol, contrasena, concejalId } = req.body;
    
    // Encriptación de contraseña (Salt de 10 rondas)
    const salt = await bcrypt.genSalt(10);
    const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

    await prisma.usuario.create({
      data: { 
        nombre, 
        cedula, 
        telefono, 
        rol, 
        contrasena: contrasenaEncriptada,
        // Lógica relacional: Si es LIDER y pertenece a un CONCEJAL, guardamos el ID
        concejalId: rol === 'LIDER' && concejalId ? parseInt(concejalId) : null
      }
    });
    res.status(201).json({ mensaje: `¡${rol} creado y enlazado con éxito!` });
  } catch (error) { 
    console.error("[POST Usuarios Error]:", error);
    res.status(500).json({ error: 'Error al crear usuario. Verifica si la cédula ya existe.' }); 
  }
});

/**
 * @route DELETE /api/usuarios/:id
 * @desc Despide a un usuario. Permite borrar sus datos en cascada o transferirlos al Admin.
 */
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const idUsuario = parseInt(req.params.id);
    const { accion, adminId } = req.body; 

    // Flujo de protección de datos: Transferir o Borrar
    if (accion === 'transferir') {
      await prisma.simpatizante.updateMany({
        where: { liderId: idUsuario },
        data: { liderId: adminId }
      });
    } else {
      await prisma.simpatizante.deleteMany({ where: { liderId: idUsuario } });
    }
    
    await prisma.usuario.delete({ where: { id: idUsuario } });
    res.json({ mensaje: 'Usuario gestionado y eliminado correctamente' });
  } catch (error) { 
    console.error("[DELETE Usuarios Error]:", error);
    res.status(500).json({ error: 'Error de integridad al eliminar usuario' }); 
  }
});

/* =========================================================================
   3. MÓDULO DE AUTENTICACIÓN Y SEGURIDAD
   ========================================================================= */

/**
 * @route POST /api/login
 * @desc Autentica a un usuario y genera un JWT (JSON Web Token) para la sesión.
 */
app.post('/api/login', async (req, res) => {
  try {
    const { cedula, contrasena } = req.body;
    
    const usuario = await prisma.usuario.findUnique({ where: { cedula } });
    if (!usuario) return res.status(401).json({ error: 'Usuario no encontrado en la base de datos' });

    // Verificación de Hash
    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!contrasenaValida) return res.status(401).json({ error: 'Contraseña incorrecta' });

    // Generación de Token de Sesión (Expira en 8 horas de jornada laboral)
    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }, 
      SECRET_KEY, 
      { expiresIn: '8h' }
    );
    
    res.json({ 
      mensaje: 'Login exitoso', 
      token: token, 
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } 
    });
  } catch (error) { 
    console.error("[POST Login Error]:", error);
    res.status(500).json({ error: 'Error interno en el servidor de autenticación' }); 
  }
});

/* =========================================================================
   4. MÓDULO DE AUDITORÍA GLOBAL (LOGS)
   ========================================================================= */

/**
 * @route GET /api/alertas
 * @desc Obtiene el historial de conflictos (ej. intentos de cédulas duplicadas).
 */
app.get('/api/alertas', async (req, res) => {
  try {
    const alertas = await prisma.alerta.findMany({ orderBy: { fecha: 'desc' } });
    res.json(alertas);
  } catch (error) { 
    console.error("[GET Alertas Error]:", error);
    res.status(500).json({ error: "Error obteniendo alertas de auditoría" }); 
  }
});

/**
 * @route POST /api/alertas
 * @desc Registra un nuevo conflicto en la bitácora de auditoría.
 */
app.post('/api/alertas', async (req, res) => {
  try {
    const { cedula, nombre, motivo } = req.body;
    const alerta = await prisma.alerta.create({ data: { cedula, nombre, motivo } });
    res.status(201).json(alerta);
  } catch (error) { 
    console.error("[POST Alertas Error]:", error);
    res.status(500).json({ error: "Error registrando la alerta" }); 
  }
});

/**
 * @route DELETE /api/alertas
 * @desc Limpia completamente la bitácora de auditoría (Solo para limpieza de mantenimiento).
 */
app.delete('/api/alertas', async (req, res) => {
  try {
    await prisma.alerta.deleteMany({});
    res.json({ message: "Historial de auditoría limpiado exitosamente" });
  } catch (error) { 
    console.error("[DELETE Alertas Error]:", error);
    res.status(500).json({ error: "Error al purgar las alertas" }); 
  }
});

/* =========================================================================
   INICIALIZACIÓN DEL SERVIDOR
   ========================================================================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
  console.log(`✅ Servidor API Electora corriendo de forma segura en el puerto ${PORT}`); 
});