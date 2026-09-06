const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json()); 

const SECRET_KEY = "secreto_super_seguro_calima"; 

// --- 🕒 SISTEMA DE CLAVE DINÁMICA ---
const generarPinDinamico = () => {
  const minutoActual = Math.floor(Date.now() / 60000);
  const operaciones = Math.abs(Math.sin(minutoActual * 12345) * 1000000);
  return Math.floor(operaciones).toString().padStart(6, '0');
};

app.get('/api/pin-seguridad', (req, res) => {
  res.json({ pin: generarPinDinamico() });
});

// --- RUTAS DE SIMPATIZANTES ---
app.get('/api/simpatizantes', async (req, res) => {
  try {
    // 👈 NUEVO: Traemos al líder y también al concejal "jefe" de ese líder
    const simpatizantes = await prisma.simpatizante.findMany({
      include: { lider: { include: { concejal: true } } } 
    });
    res.json(simpatizantes);
  } catch (error) { res.status(500).json({ error: 'Error en la base de datos' }); }
});

app.post('/api/simpatizantes', async (req, res) => {
  try {
    const existe = await prisma.simpatizante.findFirst({ where: { cedula: req.body.cedula } });
    if (existe) {
      return res.status(400).json({ error: '¡ATENCIÓN! Esta cédula ya se encuentra registrada en el sistema.' });
    }
    const nuevoSimpatizante = await prisma.simpatizante.create({ data: req.body });
    res.json({ mensaje: '¡Simpatizante guardado!', datos: nuevoSimpatizante });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Error interno al guardar simpatizante' }); 
  }
});

app.delete('/api/simpatizantes/:id', async (req, res) => {
  try {
    await prisma.simpatizante.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ mensaje: 'Simpatizante eliminado' });
  } catch (error) { res.status(500).json({ error: 'Error al eliminar el registro' }); }
});

app.put('/api/simpatizantes/:id/transferir', async (req, res) => {
  try {
    await prisma.simpatizante.update({
      where: { id: parseInt(req.params.id) },
      data: { liderId: parseInt(req.body.nuevoLiderId) }
    });
    res.json({ mensaje: 'Reasignado' });
  } catch (error) { res.status(500).json({ error: 'Error al reasignar' }); }
});

// --- RUTAS DE USUARIOS (JERARQUÍAS) ---
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      include: { concejal: true, equipoLideres: true }
    });
    // Limpiamos las contraseñas antes de enviarlas por seguridad
    const usuariosSeguros = usuarios.map(u => { const { contrasena, ...resto } = u; return resto; });
    res.json(usuariosSeguros);
  } catch (error) { res.status(500).json({ error: 'Error al obtener usuarios' }); }
});

app.post('/api/usuarios', async (req, res) => {
  try {
    const { nombre, cedula, telefono, rol, contrasena, codigoAutorizacion, concejalId } = req.body;
    
    // 🛡️ BARRERA ESTRICTA: El administrador inyectará el PIN automáticamente desde el Frontend
    if (!codigoAutorizacion || codigoAutorizacion !== generarPinDinamico()) {
      return res.status(401).json({ error: 'Autorización denegada. El PIN es inválido.' });
    }

    const salt = await bcrypt.genSalt(10);
    const contrasenaEncriptada = await bcrypt.hash(contrasena, salt);

    await prisma.usuario.create({
      data: { 
        nombre, 
        cedula, 
        telefono, 
        rol, 
        contrasena: contrasenaEncriptada,
        // Si el rol es LIDER y mandan el ID del concejal, lo guardamos
        concejalId: rol === 'LIDER' && concejalId ? parseInt(concejalId) : null
      }
    });
    res.json({ mensaje: `¡${rol} creado con éxito!` });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario. Revisa si la cédula ya existe.' }); 
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const idUsuario = parseInt(req.params.id);
    const { accion, adminId } = req.body; 

    if (accion === 'transferir') {
      await prisma.simpatizante.updateMany({
        where: { liderId: idUsuario },
        data: { liderId: adminId }
      });
    } else {
      await prisma.simpatizante.deleteMany({ where: { liderId: idUsuario } });
    }
    await prisma.usuario.delete({ where: { id: idUsuario } });
    res.json({ mensaje: 'Usuario gestionado' });
  } catch (error) { res.status(500).json({ error: 'Error al eliminar' }); }
});

// EDITAR SIMPATIZANTE (Mesa y Observaciones)
app.put('/api/simpatizantes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { mesa, observaciones } = req.body;
    const simpatizante = await prisma.simpatizante.update({
      where: { id: Number(id) },
      data: { mesa, observaciones }
    });
    res.json(simpatizante);
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar simpatizante" });
  }
});

// --- LOGIN ---
app.post('/api/login', async (req, res) => {
  try {
    const { cedula, contrasena } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { cedula } });
    if (!usuario) return res.status(401).json({ error: 'Usuario no encontrado' });

    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!contrasenaValida) return res.status(401).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol, nombre: usuario.nombre }, 
      SECRET_KEY, { expiresIn: '8h' }
    );
    res.json({ mensaje: 'Login exitoso', token: token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (error) { res.status(500).json({ error: 'Error en servidor' }); }
});

// --- RUTAS DE AUDITORÍA Y ALERTAS ---
app.get('/api/alertas', async (req, res) => {
  try {
    const alertas = await prisma.alerta.findMany({ orderBy: { fecha: 'desc' } });
    res.json(alertas);
  } catch (error) { res.status(500).json({ error: "Error obteniendo alertas" }); }
});

app.post('/api/alertas', async (req, res) => {
  try {
    const { cedula, nombre, motivo } = req.body;
    const alerta = await prisma.alerta.create({ data: { cedula, nombre, motivo } });
    res.json(alerta);
  } catch (error) { res.status(500).json({ error: "Error creando alerta" }); }
});

app.delete('/api/alertas', async (req, res) => {
  try {
    await prisma.alerta.deleteMany({});
    res.json({ message: "Historial limpiado" });
  } catch (error) { res.status(500).json({ error: "Error limpiando alertas" }); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`✅ Servidor corriendo en http://localhost:${PORT}`); });