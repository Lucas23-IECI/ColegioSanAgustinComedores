const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { verifyToken, verifyRole, JWT_SECRET } = require('./middleware/auth');

const app = express();
// Configuracion de CORS vital para aceptar cookies del puerto de React
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT || 5000;

// === AUTENTICACIÓN ===
app.post('/api/auth/login', async (req, res) => {
  const { correo, password } = req.body;
  if (!correo || !password) return res.status(400).json({ message: 'Faltan credenciales' });

  try {
    const userQuery = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo.trim()]);
    if (userQuery.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = userQuery.rows[0];
    const passMatch = await bcrypt.compare(password, user.password_hash);
    if (!passMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, correo: user.correo, rol: user.rol }, 
      JWT_SECRET, 
      { expiresIn: '8h' }
    );

    // Guardado de Token como Cookie HttpOnly (Proteccion XSS)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 Horas
    });

    res.json({ user: { id: user.id, correo: user.correo, rol: user.rol } });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
});

// Endpoint para restaurar sesion al recargar (React no puede leer HttpOnly Cookes)
app.get('/api/auth/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

// Elimina la cookie al salir
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout exitoso' });
});

// === ALUMNOS Y ESCÁNER (Lector o Admin) ===
app.get('/api/students/scan/:barcode', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  const { barcode } = req.params;
  const { tipo_alimentacion } = req.query;

  try {
    const queryAlumno = `
      SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.activo as alumno_activo, c.nombre_curso
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE a.codigo_barra = $1
    `;
    const resultAlumno = await pool.query(queryAlumno, [barcode]);
    if (resultAlumno.rows.length === 0) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }
    const alumno = resultAlumno.rows[0];

    // BLOQUEO INACTIVOS: Nunca se puede registrar comida si se dio de baja al alumno
    if (!alumno.alumno_activo) {
      return res.status(403).json({ message: 'Alumno Inactivo en el sistema. Prohibido registrar consumos.', alumno_inactivo: true });
    }

    // REVISAR FECHAS DE BENEFICIO: Ahora valida la ventana de tiempo del beneficio social.
    const queryBenef = `
      SELECT activo 
      FROM beneficiario_alimentacion 
      WHERE id_alumno = $1 
        AND activo = true 
        AND CURRENT_DATE >= fecha_inicio 
        AND (fecha_fin IS NULL OR CURRENT_DATE <= fecha_fin)
    `;
    const resBenef = await pool.query(queryBenef, [alumno.id_alumno]);
    const esBeneficiario = resBenef.rows.length > 0;

    // RESTRICCIONES DIETARIAS
    const queryRestric = `SELECT descripcion FROM restriccion_dietaria WHERE id_alumno = $1 AND vigente = true`;
    const resRestric = await pool.query(queryRestric, [alumno.id_alumno]);
    const restricciones = resRestric.rows.map(r => r.descripcion);

    // COMPROBACION HOY
    let alreadyRegistered = false;
    if (tipo_alimentacion) {
      const queryCheck = `
        SELECT id_registro FROM lunch_registrations 
        WHERE id_alumno = $1 AND tipo_alimentacion = $2 AND fecha_entrega = CURRENT_DATE
      `;
      const resCheck = await pool.query(queryCheck, [alumno.id_alumno, tipo_alimentacion]);
      alreadyRegistered = resCheck.rows.length > 0;
    }

    res.json({ 
      alumno, 
      esBeneficiario, 
      restricciones,
      alreadyRegistered 
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
});

// === REALIZAR REGISTRO ===
app.post('/api/lunches', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  const { id_alumno, tipo_alimentacion } = req.body;
  if (!id_alumno || !tipo_alimentacion) return res.status(400).json({ message: 'Faltan datos' });

  try {
     const queryAlumno = `SELECT activo FROM alumno WHERE id_alumno = $1`;
     const resAlu = await pool.query(queryAlumno, [id_alumno]);
     if (resAlu.rows.length === 0 || !resAlu.rows[0].activo) {
        return res.status(403).json({ message: 'No se puede registrar consumo a alumno inactivo' });
     }

    const queryBenef = `
      SELECT activo FROM beneficiario_alimentacion 
      WHERE id_alumno = $1 AND activo = true 
      AND CURRENT_DATE >= fecha_inicio AND (fecha_fin IS NULL OR CURRENT_DATE <= fecha_fin)
    `;
    const resBenef = await pool.query(queryBenef, [id_alumno]);
    const esBeneficiario = resBenef.rows.length > 0;

    const queryInsert = `
      INSERT INTO lunch_registrations (id_alumno, tipo_alimentacion, es_beneficiario_al_momento)
      VALUES ($1, $2, $3) RETURNING *
    `;
    const result = await pool.query(queryInsert, [id_alumno, tipo_alimentacion, esBeneficiario]);

    res.json({ message: 'Registrado', registro: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

// === WIP ADMIN REPORTES ===
app.get('/api/admin/reportes/recurrentes', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT a.rut, a.nombres, a.paterno, c.nombre_curso, COUNT(lr.id_registro) as total_consumos
      FROM lunch_registrations lr
      JOIN alumno a ON lr.id_alumno = a.id_alumno
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE lr.es_beneficiario_al_momento = false
      GROUP BY a.rut, a.nombres, a.paterno, c.nombre_curso
      ORDER BY total_consumos DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch(err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

app.get('/api/lunches/history', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  const { from, to } = req.query;
  try {
    const query = `
      SELECT lr.id_registro, a.rut, a.nombres, a.paterno, c.nombre_curso, lr.tipo_alimentacion, lr.fecha_entrega, lr.hora_entrega, lr.es_beneficiario_al_momento
      FROM lunch_registrations lr
      JOIN alumno a ON lr.id_alumno = a.id_alumno
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE lr.fecha_entrega >= $1 AND lr.fecha_entrega <= $2
      ORDER BY lr.fecha_entrega DESC, lr.hora_entrega DESC
    `;
    const result = await pool.query(query, [from || '2000-01-01', to || '2100-01-01']);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// === MAESTRO ESTUDIANTES (PARA CRUD ADMIN) ===
app.get('/api/students', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const query = `
      SELECT a.id_alumno as id, a.rut, a.nombres || ' ' || a.paterno as name, c.nombre_curso as grade, a.activo
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      ORDER BY a.id_alumno ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch(err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

app.get('/api/students/:id/details', verifyToken, verifyRole(['admin']), async (req, res) => {
  const { id } = req.params;
  try {
    // Info Base
    const alumnoRes = await pool.query(
      'SELECT a.*, c.nombre_curso as grado FROM alumno a LEFT JOIN matricula m ON a.id_alumno = m.id_alumno LEFT JOIN curso c ON m.id_curso = c.id_curso WHERE a.id_alumno = $1', [id]
    );
    if (alumnoRes.rows.length === 0) return res.status(404).json({ message: 'Alumno no hallado' });
    
    // Anexos
    const contactoRes = await pool.query('SELECT p.*, r.tipo_relacion, r.es_contacto_principal, r.vive_con_alumno, r.autoriza_foto FROM persona_contacto p JOIN relacion_alumno_persona r ON p.id_persona = r.id_persona WHERE r.id_alumno = $1', [id]);
    const saludRes = await pool.query('SELECT * FROM salud WHERE id_alumno = $1', [id]);
    const emergenciaRes = await pool.query('SELECT * FROM emergencia WHERE id_alumno = $1', [id]);
    const pagoRes = await pool.query('SELECT * FROM pago WHERE id_alumno = $1', [id]);
    const apoyoRes = await pool.query('SELECT * FROM programa_apoyo WHERE id_alumno = $1', [id]);
    const benefRes = await pool.query('SELECT * FROM beneficiario_alimentacion WHERE id_alumno = $1', [id]);
    const restRes = await pool.query('SELECT * FROM restriccion_dietaria WHERE id_alumno = $1', [id]);

    res.json({
      alumno: alumnoRes.rows[0],
      contactos: contactoRes.rows,
      salud: saludRes.rows[0] || null,
      emergencia: emergenciaRes.rows[0] || null,
      finanzas: pagoRes.rows[0] || null,
      apoyo: apoyoRes.rows[0] || null,
      beneficios: benefRes.rows[0] || null,
      restricciones: restRes.rows.map(r => r.descripcion)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error interno en JOINs');
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
