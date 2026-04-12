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

const sanitizeText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeHeaderKey = (value) => {
  return sanitizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

const pickRowValue = (row, aliases) => {
  const aliasSet = new Set(aliases.map((alias) => normalizeHeaderKey(alias)));
  for (const [key, value] of Object.entries(row || {})) {
    if (!aliasSet.has(normalizeHeaderKey(key))) continue;
    if (value === undefined || value === null) continue;
    const cleaned = sanitizeText(value);
    if (cleaned !== '') return cleaned;
  }
  return '';
};

const normalizeRutAndDv = (rutInput, dvInput) => {
  const rawRut = sanitizeText(rutInput).toUpperCase().replace(/\./g, '');
  const rawDv = sanitizeText(dvInput).toUpperCase();

  if (!rawRut) return { rut: '', dv: '' };

  if (rawRut.includes('-')) {
    const [rutPart, dvPart] = rawRut.split('-');
    return {
      rut: rutPart.replace(/\D/g, ''),
      dv: (dvPart || '').replace(/[^0-9K]/g, '').slice(0, 1)
    };
  }

  return {
    rut: rawRut.replace(/\D/g, ''),
    dv: rawDv.replace(/[^0-9K]/g, '').slice(0, 1)
  };
};

const toBooleanOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'si', 'sí', 'yes', 'activo'].includes(normalized)) return true;
  if (['false', '0', 'no', 'inactivo', 'retirado', 'baja', 'egresado'].includes(normalized)) return false;
  return null;
};

const normalizeDateInput = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Excel serial date: days since 1899-12-30.
    const base = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    const parsed = new Date(base.getTime() + ms);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  const cleaned = sanitizeText(value);
  if (!cleaned) return null;

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const normalizeDateTimeInput = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number' && Number.isFinite(value)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 24 * 60 * 60 * 1000;
    const parsed = new Date(base.getTime() + ms);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  const cleaned = sanitizeText(value);
  if (!cleaned) return null;

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  return null;
};

const normalizeKeyword = (value) => {
  return sanitizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const toNullable = (value) => {
  const cleaned = sanitizeText(value);
  return cleaned ? cleaned : null;
};

const parseBenefitActive = (value) => {
  const boolValue = toBooleanOrNull(value);
  if (boolValue !== null) return boolValue;

  const normalized = normalizeKeyword(value);
  if (!normalized) return null;
  if (normalized.includes('junaeb') || normalized.includes('benef')) return true;
  if (normalized.includes('sin') || normalized.includes('ningun')) return false;
  return null;
};

const splitContactName = (fullName) => {
  const cleaned = sanitizeText(fullName);
  if (!cleaned) return { nombres: '', paterno: '', materno: '' };

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { nombres: parts[0], paterno: parts[0], materno: '' };
  }

  if (parts.length === 2) {
    return { nombres: parts[0], paterno: parts[1], materno: '' };
  }

  return {
    nombres: parts.slice(0, parts.length - 2).join(' '),
    paterno: parts[parts.length - 2],
    materno: parts[parts.length - 1]
  };
};

const parseContactData = (row, prefix, roleLabel) => {
  const rutRaw = pickRowValue(row, [`Rut_${prefix}`, `${prefix}_rut`, `rut ${prefix}`]);
  const dvRaw = pickRowValue(row, [`Dv_${prefix}`, `${prefix}_dv`, `dv ${prefix}`]);
  const { rut, dv } = normalizeRutAndDv(rutRaw, dvRaw);

  const nombresField = pickRowValue(row, [`Nombre_${prefix}`, `Nombres_${prefix}`, `${prefix}_nombre`]);
  const paternoField = pickRowValue(row, [`Paterno_${prefix}`, `${prefix}_paterno`]);
  const maternoField = pickRowValue(row, [`Materno_${prefix}`, `${prefix}_materno`]);

  let nombres = nombresField;
  let paterno = paternoField;
  let materno = maternoField;

  if ((!nombres || !paterno) && nombresField) {
    const split = splitContactName(nombresField);
    nombres = nombres || split.nombres;
    paterno = paterno || split.paterno;
    materno = materno || split.materno;
  }

  const telefono = pickRowValue(row, [`Telefono_${prefix}`, `Teléfono_${prefix}`, `${prefix}_telefono`]);
  const email = pickRowValue(row, [`Email_${prefix}`, `${prefix}_email`]);
  const direccion = pickRowValue(row, [`Direccion_${prefix}`, `Dirección_${prefix}`, `${prefix}_direccion`]);

  const hasMeaningfulData = Boolean(rut || nombres || paterno || telefono || email || direccion);
  if (!hasMeaningfulData) return null;

  return {
    role: roleLabel,
    rut,
    dv,
    nombres,
    paterno,
    materno,
    telefono,
    email,
    direccion
  };
};

const valuesAreDifferent = (currentValue, nextValue) => {
  if (currentValue === null || currentValue === undefined) return nextValue !== null;
  if (currentValue instanceof Date) {
    return currentValue.toISOString().slice(0, 10) !== nextValue;
  }
  return String(currentValue) !== String(nextValue ?? '');
};

const upsertSimpleByAlumno = async (client, tableName, idFieldName, idAlumno, payload) => {
  const keys = Object.keys(payload);
  if (!keys.length) return false;

  const existingRes = await client.query(`SELECT ${idFieldName}, ${keys.join(', ')} FROM ${tableName} WHERE id_alumno = $1 LIMIT 1`, [idAlumno]);
  const existing = existingRes.rows[0];

  if (!existing) {
    const values = keys.map((key) => payload[key]);
    const columns = ['id_alumno', ...keys];
    const placeholders = columns.map((_, idx) => `$${idx + 1}`);
    await client.query(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      [idAlumno, ...values]
    );
    return true;
  }

  const changedKeys = keys.filter((key) => {
    const nextVal = payload[key] ?? null;
    const currVal = existing[key] ?? null;
    return valuesAreDifferent(currVal, nextVal);
  });

  if (!changedKeys.length) return false;

  const setClause = changedKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
  const updateValues = changedKeys.map((key) => payload[key]);
  await client.query(
    `UPDATE ${tableName} SET ${setClause} WHERE ${idFieldName} = $${changedKeys.length + 1}`,
    [...updateValues, existing[idFieldName]]
  );
  return true;
};

const ensureContactAndRelation = async (client, idAlumno, contact, relationConfig) => {
  if (!contact) return false;

  const normalizedNames = splitContactName(contact.nombres);
  const nombres = contact.nombres || normalizedNames.nombres;
  const paterno = contact.paterno || normalizedNames.paterno;
  const materno = contact.materno || normalizedNames.materno;

  if (!nombres || !paterno) return false;

  let person = null;
  if (contact.rut) {
    const byRut = await client.query('SELECT * FROM persona_contacto WHERE rut = $1 LIMIT 1', [contact.rut]);
    person = byRut.rows[0] || null;
  }

  if (!person) {
    const byIdentity = await client.query(
      `
        SELECT * FROM persona_contacto
        WHERE LOWER(nombres) = LOWER($1)
          AND LOWER(paterno) = LOWER($2)
          AND COALESCE(LOWER(materno), '') = COALESCE(LOWER($3), '')
          AND COALESCE(telefono, '') = COALESCE($4, '')
        LIMIT 1
      `,
      [nombres, paterno, materno || null, contact.telefono || null]
    );
    person = byIdentity.rows[0] || null;
  }

  let idPersona;
  let changed = false;

  if (!person) {
    const inserted = await client.query(
      `
        INSERT INTO persona_contacto (rut, dv, nombres, paterno, materno, telefono, email, direccion)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id_persona
      `,
      [
        contact.rut || null,
        contact.dv || null,
        nombres,
        paterno,
        materno || null,
        contact.telefono || null,
        contact.email || null,
        contact.direccion || null
      ]
    );
    idPersona = inserted.rows[0].id_persona;
    changed = true;
  } else {
    idPersona = person.id_persona;
    const personPayload = {
      rut: contact.rut || null,
      dv: contact.dv || null,
      nombres,
      paterno,
      materno: materno || null,
      telefono: contact.telefono || null,
      email: contact.email || null,
      direccion: contact.direccion || null
    };

    const changedKeys = Object.keys(personPayload).filter((key) => {
      const curr = person[key] ?? null;
      const next = personPayload[key] ?? null;
      return valuesAreDifferent(curr, next);
    });

    if (changedKeys.length) {
      const setClause = changedKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
      const updateValues = changedKeys.map((key) => personPayload[key]);
      await client.query(
        `UPDATE persona_contacto SET ${setClause} WHERE id_persona = $${changedKeys.length + 1}`,
        [...updateValues, idPersona]
      );
      changed = true;
    }
  }

  const relExistingRes = await client.query(
    `
      SELECT id_relacion, tipo_relacion, autoriza_foto, es_contacto_principal, vive_con_alumno
      FROM relacion_alumno_persona
      WHERE id_alumno = $1 AND id_persona = $2 AND LOWER(tipo_relacion) = LOWER($3)
      LIMIT 1
    `,
    [idAlumno, idPersona, relationConfig.tipo_relacion]
  );

  const relExisting = relExistingRes.rows[0];
  if (!relExisting) {
    await client.query(
      `
        INSERT INTO relacion_alumno_persona (id_alumno, id_persona, tipo_relacion, autoriza_foto, es_contacto_principal, vive_con_alumno)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        idAlumno,
        idPersona,
        relationConfig.tipo_relacion,
        relationConfig.autoriza_foto,
        relationConfig.es_contacto_principal,
        relationConfig.vive_con_alumno
      ]
    );
    changed = true;
  } else {
    const relChanges = [];
    if (relExisting.autoriza_foto !== relationConfig.autoriza_foto) relChanges.push(['autoriza_foto', relationConfig.autoriza_foto]);
    if (relExisting.es_contacto_principal !== relationConfig.es_contacto_principal) relChanges.push(['es_contacto_principal', relationConfig.es_contacto_principal]);
    if (relExisting.vive_con_alumno !== relationConfig.vive_con_alumno) relChanges.push(['vive_con_alumno', relationConfig.vive_con_alumno]);

    if (relChanges.length) {
      const setClause = relChanges.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = relChanges.map(([, value]) => value);
      await client.query(
        `UPDATE relacion_alumno_persona SET ${setClause} WHERE id_relacion = $${relChanges.length + 1}`,
        [...values, relExisting.id_relacion]
      );
      changed = true;
    }
  }

  return changed;
};

const parseStudentRow = (row) => {
  const rutValue = pickRowValue(row, ['rut', 'run', 'rut alumno', 'run alumno', 'id alumno']);
  const dvValue = pickRowValue(row, ['dv', 'digito verificador', 'digito', 'verificador']);
  const { rut, dv } = normalizeRutAndDv(rutValue, dvValue);

  const matricula = pickRowValue(row, ['matr.', 'matr', 'matricula']);
  const nombresRaw = pickRowValue(row, ['nombres', 'nombre', 'name']);
  const paternoRaw = pickRowValue(row, ['paterno', 'apellido paterno', 'primer apellido']);
  const maternoRaw = pickRowValue(row, ['materno', 'apellido materno', 'segundo apellido']);
  const apellidoRaw = pickRowValue(row, ['apellidos', 'apellido', 'last name', 'lastname']);
  const nombreCompletoRaw = pickRowValue(row, ['nombre completo', 'full name', 'alumno']);

  let nombres = nombresRaw;
  let paterno = paternoRaw;
  let materno = maternoRaw;

  if (!paterno && apellidoRaw) {
    const surnameParts = apellidoRaw.split(/\s+/).filter(Boolean);
    if (surnameParts.length > 0) {
      paterno = surnameParts[0];
      materno = materno || surnameParts.slice(1).join(' ');
    }
  }

  if ((!nombres || !paterno) && nombreCompletoRaw) {
    const parts = nombreCompletoRaw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      paterno = paterno || parts[parts.length - 1];
      nombres = nombres || parts.slice(0, parts.length - 1).join(' ');
    } else if (parts.length === 1) {
      nombres = nombres || parts[0];
      paterno = paterno || parts[0];
    }
  }

  const cursoRaw = pickRowValue(row, ['grade', 'curso', 'nombre curso', 'curso actual']);
  const ensenanzaRaw = pickRowValue(row, ['ensenanza', 'enseñanza', 'nivel', 'nivel curso']);
  const grade = cursoRaw || ensenanzaRaw;

  const email = pickRowValue(row, ['email', 'correo', 'correo electronico', 'mail']);
  const telefono = pickRowValue(row, ['telefono', 'teléfono', 'telefono alumno']);
  const direccion = pickRowValue(row, ['direccion', 'dirección']);
  const ciudad = pickRowValue(row, ['ciudad']);
  const comuna = pickRowValue(row, ['comuna']);
  const sexo = pickRowValue(row, ['sexo']);
  const fechaNacimiento = normalizeDateInput(pickRowValue(row, ['fecha nac', 'fecha nacimiento', 'fecha_nac']));
  const activo = toBooleanOrNull(pickRowValue(row, ['activo', 'estado', 'vigente']));

  const fechaMatricula = normalizeDateInput(pickRowValue(row, ['fecha matricula', 'fecha matrícula', 'fecha_matricula']));
  const fechaRetiro = normalizeDateInput(pickRowValue(row, ['fecha retiro', 'fecha_retiro']));
  const fechaInscripcion = normalizeDateInput(pickRowValue(row, ['fec. inscripcion', 'fec. inscripción', 'fecha inscripcion', 'fecha inscripción', 'fecha_inscripcion']));
  const repetidor = toBooleanOrNull(pickRowValue(row, ['repetidor']));
  const alumnoNuevo = toBooleanOrNull(pickRowValue(row, ['alumno_nuevo', 'alumno nuevo']));

  const vulnerable = toBooleanOrNull(pickRowValue(row, ['vulnerable']));
  const prioritario = toBooleanOrNull(pickRowValue(row, ['prioritario']));
  const preferente = toBooleanOrNull(pickRowValue(row, ['preferente']));
  const proRetencion = toBooleanOrNull(pickRowValue(row, ['pro-retencion', 'pro retencion', 'pro_retencion']));

  const formapago = pickRowValue(row, ['formapago_bancaria', 'forma pago bancaria', 'forma_pago']);
  const banco = pickRowValue(row, ['banco']);
  const tipoCuenta = pickRowValue(row, ['tipo_cuenta_bancaria', 'tipo cuenta bancaria', 'tipo_cuenta']);
  const numeroCuenta = pickRowValue(row, ['nu_cuenta_bancaria', 'num cuenta bancaria', 'numero_cuenta']);

  const asma = toBooleanOrNull(pickRowValue(row, ['asma']));
  const diabetes = toBooleanOrNull(pickRowValue(row, ['diabetes']));
  const epilepsia = toBooleanOrNull(pickRowValue(row, ['epilepsia']));
  const observacionesSalud = pickRowValue(row, ['observaciones_salud', 'observaciones salud']);

  const avisarA = pickRowValue(row, ['avisar_a', 'avisar a']);
  const telefonoEmergencia = pickRowValue(row, ['telefono _emergencia', 'telefono_emergencia', 'teléfono_emergencia', 'telefono emergencia']);
  const trasladarA = pickRowValue(row, ['trasladar_a', 'trasladar a']);

  const lista = pickRowValue(row, ['lista']);
  const beneficiarioActivo = parseBenefitActive(lista);

  const alergiaMedicamentos = pickRowValue(row, ['alergia_medicamentos', 'alergia medicamentos']);

  const contactos = [
    parseContactData(row, 'padre', 'Padre'),
    parseContactData(row, 'madre', 'Madre'),
    parseContactData(row, 'apoderado', 'Apoderado'),
    parseContactData(row, 'apoderado2', 'Apoderado 2'),
    parseContactData(row, 'tutor', 'Tutor')
  ].filter(Boolean);

  const autorizaFotoApoderado = toBooleanOrNull(pickRowValue(row, ['autoriza_foto_apoderado', 'autoriza foto apoderado']));
  const fechaActualizacion = normalizeDateTimeInput(pickRowValue(row, ['fecha_actualizacion', 'fecha actualizacion', 'fec actualización']));

  return {
    rut,
    dv,
    matricula,
    nombres,
    paterno,
    materno,
    grade,
    email,
    telefono,
    direccion: [direccion, comuna, ciudad].filter(Boolean).join(', '),
    sexo,
    fechaNacimiento,
    activo,
    fechaMatricula,
    fechaRetiro,
    fechaInscripcion,
    repetidor,
    alumnoNuevo,
    vulnerable,
    prioritario,
    preferente,
    proRetencion,
    formapago,
    banco,
    tipoCuenta,
    numeroCuenta,
    asma,
    diabetes,
    epilepsia,
    observacionesSalud,
    avisarA,
    telefonoEmergencia,
    trasladarA,
    beneficiarioActivo,
    alergiaMedicamentos,
    contactos,
    autorizaFotoApoderado,
    fechaActualizacion
  };
};

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
  const tipoAlimentacionNormalizado = (tipo_alimentacion || '').toString().trim().toLowerCase();

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
    `;
    const resBenef = await pool.query(queryBenef, [alumno.id_alumno]);
    const esBeneficiario = resBenef.rows.length > 0;

    // RESTRICCIONES DIETARIAS
    const queryRestric = `SELECT descripcion FROM restriccion_dietaria WHERE id_alumno = $1 AND vigente = true`;
    const resRestric = await pool.query(queryRestric, [alumno.id_alumno]);
    const restricciones = resRestric.rows.map(r => r.descripcion);

    // COMPROBACION HOY
    let alreadyRegistered = false;
    if (tipoAlimentacionNormalizado) {
      const queryCheck = `
        SELECT id_registro FROM lunch_registrations 
        WHERE id_alumno = $1 AND LOWER(tipo_alimentacion) = $2 AND fecha_entrega = CURRENT_DATE
      `;
      const resCheck = await pool.query(queryCheck, [alumno.id_alumno, tipoAlimentacionNormalizado]);
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
  const tipoAlimentacionNormalizado = (tipo_alimentacion || '').toString().trim().toLowerCase();
  if (!id_alumno || !tipoAlimentacionNormalizado) return res.status(400).json({ message: 'Faltan datos' });

  try {
     const queryAlumno = `SELECT activo FROM alumno WHERE id_alumno = $1`;
     const resAlu = await pool.query(queryAlumno, [id_alumno]);
     if (resAlu.rows.length === 0 || !resAlu.rows[0].activo) {
        return res.status(403).json({ message: 'No se puede registrar consumo a alumno inactivo' });
     }

    const queryBenef = `
      SELECT activo FROM beneficiario_alimentacion 
      WHERE id_alumno = $1 AND activo = true
    `;
    const resBenef = await pool.query(queryBenef, [id_alumno]);
    const esBeneficiario = resBenef.rows.length > 0;

    const queryInsert = `
      INSERT INTO lunch_registrations (id_alumno, tipo_alimentacion, es_beneficiario_al_momento)
      VALUES ($1, $2, $3) RETURNING *
    `;
    const result = await pool.query(queryInsert, [id_alumno, tipoAlimentacionNormalizado, esBeneficiario]);

    res.json({ message: 'Registrado', registro: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

// === RESUMEN DEL DÍA ===
app.get('/api/admin/alimentacion/resumen-dia', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    // Conteos por tipo de alimentación hoy
    const countQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE LOWER(tipo_alimentacion) = 'almuerzo') as total_almuerzos,
        COUNT(*) FILTER (WHERE LOWER(tipo_alimentacion) = 'desayuno') as total_desayunos,
        COUNT(*) FILTER (WHERE es_beneficiario_al_momento = true) as total_beneficiarios,
        COUNT(*) FILTER (WHERE es_beneficiario_al_momento = false) as total_no_beneficiarios,
        COUNT(*) as total_general
      FROM lunch_registrations
      WHERE fecha_entrega = CURRENT_DATE
    `;
    const countResult = await pool.query(countQuery);

    // Últimos 5 registros del día
    const recentQuery = `
      SELECT lr.id_registro, a.nombres, a.paterno, c.nombre_curso, lr.tipo_alimentacion, lr.hora_entrega, lr.es_beneficiario_al_momento
      FROM lunch_registrations lr
      JOIN alumno a ON lr.id_alumno = a.id_alumno
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE lr.fecha_entrega = CURRENT_DATE
      ORDER BY lr.hora_entrega DESC
      LIMIT 5
    `;
    const recentResult = await pool.query(recentQuery);

    res.json({
      stats: countResult.rows[0],
      recientes: recentResult.rows
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

// === REPORTE MATRICIAL DE ASISTENCIA ===
app.get('/api/admin/reportes/asistencia', verifyToken, verifyRole(['admin']), async (req, res) => {
  const { desde, hasta, tipo } = req.query;
  if (!desde || !hasta) return res.status(400).json({ message: 'Faltan fechas desde/hasta' });

  try {
    let whereExtra = '';
    if (tipo === 'almuerzo') {
      whereExtra = ` AND LOWER(lr.tipo_alimentacion) = 'almuerzo'`;
    } else if (tipo === 'desayuno') {
      whereExtra = ` AND LOWER(lr.tipo_alimentacion) = 'desayuno'`;
    } else if (tipo === 'no_beneficiarios') {
      whereExtra = ` AND lr.es_beneficiario_al_momento = false`;
    }
    // tipo === 'general' => sin filtro extra

    const query = `
      SELECT 
        a.id_alumno, a.rut, a.dv, a.nombres, a.paterno, a.materno, a.email,
        c.nombre_curso,
        lr.fecha_entrega::TEXT as fecha_entrega, lr.tipo_alimentacion
      FROM lunch_registrations lr
      JOIN alumno a ON lr.id_alumno = a.id_alumno
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE lr.fecha_entrega >= $1 AND lr.fecha_entrega <= $2
      ${whereExtra}
      ORDER BY a.paterno ASC, a.materno ASC, a.nombres ASC, lr.fecha_entrega ASC
    `;
    const result = await pool.query(query, [desde, hasta]);
    res.json(result.rows);
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

// === MAESTROS (Para Listas Desplegables) ===
app.get('/api/courses', verifyToken, async (req, res) => {
  try {
    const query = `SELECT id_curso, nombre_curso FROM curso ORDER BY nombre_curso ASC`;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

app.get('/api/lunches/history', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  const { from, to, curso, beneficiario } = req.query;
  try {
    let query = `
      SELECT lr.id_registro, a.rut, a.nombres, a.paterno, a.materno, a.email, a.activo as alumno_activo, c.nombre_curso, lr.tipo_alimentacion, lr.fecha_entrega, lr.hora_entrega, lr.es_beneficiario_al_momento
      FROM lunch_registrations lr
      JOIN alumno a ON lr.id_alumno = a.id_alumno
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE lr.fecha_entrega >= $1 AND lr.fecha_entrega <= $2
    `;
    let params = [from || '2000-01-01', to || '2100-01-01'];
    let paramCount = 3;

    if (curso) {
      query += ` AND c.nombre_curso = $${paramCount}`;
      params.push(curso);
      paramCount++;
    }

    if (beneficiario === 'yes') {
      query += ` AND lr.es_beneficiario_al_momento = true`;
    } else if (beneficiario === 'no') {
      query += ` AND lr.es_beneficiario_al_momento = false`;
    }

    query += ` ORDER BY lr.fecha_entrega DESC, lr.hora_entrega DESC`;
    
    const result = await pool.query(query, params);
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

app.post('/api/students/bulk-sync', verifyToken, verifyRole(['admin']), async (req, res) => {
  const rows = Array.isArray(req.body?.students) ? req.body.students : [];

  if (!rows.length) {
    return res.status(400).json({ message: 'No se recibieron filas para procesar.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const summary = {
      total: rows.length,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      warnings: [],
      errors: []
    };

    for (let index = 0; index < rows.length; index++) {
      const excelRowNumber = index + 2;

      try {
        const normalized = parseStudentRow(rows[index]);

        if (!normalized.rut) {
          summary.errors.push({ row: excelRowNumber, message: 'RUT vacío o inválido.' });
          continue;
        }

        if (!normalized.nombres || !normalized.paterno) {
          summary.errors.push({ row: excelRowNumber, message: 'Faltan nombres o apellido paterno.' });
          continue;
        }

        // Fast path: if source timestamp did not advance, skip full row processing.
        const stampCheck = await client.query(
          'SELECT id_alumno, fecha_actualizacion FROM alumno WHERE rut = $1 LIMIT 1',
          [normalized.rut]
        );
        const existingStampRow = stampCheck.rows[0] || null;

        if (existingStampRow && normalized.fechaActualizacion) {
          const dbStamp = existingStampRow.fecha_actualizacion ? new Date(existingStampRow.fecha_actualizacion).toISOString() : null;

          if (dbStamp && dbStamp === normalized.fechaActualizacion) {
            summary.unchanged++;
            continue;
          }

          if (dbStamp && dbStamp > normalized.fechaActualizacion) {
            summary.warnings.push(`Fila ${excelRowNumber}: Fecha_actualizacion en BD es mayor que Excel; se omite por seguridad.`);
            summary.unchanged++;
            continue;
          }
        }

        let courseId = null;
        if (normalized.grade) {
          const courseLookup = await client.query('SELECT id_curso FROM curso WHERE LOWER(nombre_curso) = LOWER($1) LIMIT 1', [normalized.grade]);

          if (courseLookup.rows.length > 0) {
            courseId = courseLookup.rows[0].id_curso;
          } else {
            const insertedCourse = await client.query(
              'INSERT INTO curso (nombre_curso, id_nivel) VALUES ($1, NULL) RETURNING id_curso',
              [normalized.grade]
            );
            courseId = insertedCourse.rows[0].id_curso;
          }
        }

        const studentLookup = await client.query(
          `
            SELECT
              a.id_alumno,
              COALESCE(a.matricula, '') AS matricula,
              a.nombres,
              a.paterno,
              COALESCE(a.materno, '') AS materno,
              COALESCE(a.email, '') AS email,
              COALESCE(a.telefono, '') AS telefono,
              COALESCE(a.direccion, '') AS direccion,
              COALESCE(a.sexo, '') AS sexo,
              a.fecha_nacimiento,
              a.fecha_actualizacion,
              a.dv,
              a.activo,
              m.id_matricula,
              m.id_curso
            FROM alumno a
            LEFT JOIN LATERAL (
              SELECT id_matricula, id_curso
              FROM matricula
              WHERE id_alumno = a.id_alumno
              ORDER BY id_matricula DESC
              LIMIT 1
            ) m ON true
            WHERE a.rut = $1
            LIMIT 1
          `,
          [normalized.rut]
        );

        let rowChanged = false;
        let idAlumno;
        let existing = studentLookup.rows[0] || null;

        if (!existing) {
          const insertedStudent = await client.query(
            `
              INSERT INTO alumno (matricula, rut, dv, nombres, paterno, materno, fecha_nacimiento, sexo, email, telefono, direccion, activo)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
              RETURNING id_alumno
            `,
            [
              normalized.matricula || null,
              normalized.rut,
              normalized.dv || null,
              normalized.nombres,
              normalized.paterno,
              normalized.materno || null,
              normalized.fechaNacimiento,
              normalized.sexo || null,
              normalized.email || null,
              normalized.telefono || null,
              normalized.direccion || null,
              normalized.activo === null ? true : normalized.activo
            ]
          );

          if (normalized.fechaActualizacion) {
            await client.query('UPDATE alumno SET fecha_actualizacion = $1 WHERE id_alumno = $2', [normalized.fechaActualizacion, insertedStudent.rows[0].id_alumno]);
          }

          idAlumno = insertedStudent.rows[0].id_alumno;
          rowChanged = true;
        } else {
          idAlumno = existing.id_alumno;
          const incomingActivo = normalized.activo === null ? existing.activo : normalized.activo;

          const hasStudentChanges =
            (existing.matricula || '') !== (normalized.matricula || '') ||
            existing.nombres !== normalized.nombres ||
            existing.paterno !== normalized.paterno ||
            (existing.materno || '') !== (normalized.materno || '') ||
            (existing.email || '') !== (normalized.email || '') ||
            (existing.telefono || '') !== (normalized.telefono || '') ||
            (existing.direccion || '') !== (normalized.direccion || '') ||
            (existing.sexo || '') !== (normalized.sexo || '') ||
            (existing.fecha_nacimiento ? existing.fecha_nacimiento.toISOString().slice(0, 10) : null) !== normalized.fechaNacimiento ||
            (normalized.fechaActualizacion !== null && (existing.fecha_actualizacion ? new Date(existing.fecha_actualizacion).toISOString() : null) !== normalized.fechaActualizacion) ||
            (existing.dv || '') !== (normalized.dv || '') ||
            existing.activo !== incomingActivo;

          const nextFechaActualizacion = normalized.fechaActualizacion || (existing.fecha_actualizacion ? new Date(existing.fecha_actualizacion).toISOString() : null);

          if (hasStudentChanges) {
            await client.query(
              `
                UPDATE alumno
                SET matricula = $1,
                    dv = $2,
                    nombres = $3,
                    paterno = $4,
                    materno = $5,
                    fecha_nacimiento = $6,
                    sexo = $7,
                    email = $8,
                    telefono = $9,
                    direccion = $10,
                    activo = $11,
                    fecha_actualizacion = $12
                WHERE id_alumno = $13
              `,
              [
                normalized.matricula || null,
                normalized.dv || null,
                normalized.nombres,
                normalized.paterno,
                normalized.materno || null,
                normalized.fechaNacimiento,
                normalized.sexo || null,
                normalized.email || null,
                normalized.telefono || null,
                normalized.direccion || null,
                incomingActivo,
                nextFechaActualizacion,
                idAlumno
              ]
            );
            rowChanged = true;
          }
        }

        const matriculaRes = await client.query(
          `
            SELECT id_matricula, id_curso, fecha_matricula, fecha_inscripcion, fecha_retiro, alumno_nuevo, repetidor
            FROM matricula
            WHERE id_alumno = $1
            ORDER BY id_matricula DESC
            LIMIT 1
          `,
          [idAlumno]
        );

        const existingMatricula = matriculaRes.rows[0] || null;
        const incomingMatriculaPayload = {
          id_curso: courseId,
          fecha_matricula: normalized.fechaMatricula,
          fecha_inscripcion: normalized.fechaInscripcion,
          fecha_retiro: normalized.fechaRetiro,
          alumno_nuevo: normalized.alumnoNuevo === null ? true : normalized.alumnoNuevo,
          repetidor: normalized.repetidor === null ? false : normalized.repetidor
        };

        const hasAnyMatriculaData =
          incomingMatriculaPayload.id_curso !== null ||
          incomingMatriculaPayload.fecha_matricula !== null ||
          incomingMatriculaPayload.fecha_inscripcion !== null ||
          incomingMatriculaPayload.fecha_retiro !== null ||
          normalized.alumnoNuevo !== null ||
          normalized.repetidor !== null;

        if (!existingMatricula && hasAnyMatriculaData) {
          await client.query(
            `
              INSERT INTO matricula (id_alumno, id_curso, fecha_matricula, fecha_inscripcion, fecha_retiro, alumno_nuevo, repetidor)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              idAlumno,
              incomingMatriculaPayload.id_curso,
              incomingMatriculaPayload.fecha_matricula,
              incomingMatriculaPayload.fecha_inscripcion,
              incomingMatriculaPayload.fecha_retiro,
              incomingMatriculaPayload.alumno_nuevo,
              incomingMatriculaPayload.repetidor
            ]
          );
          rowChanged = true;
        } else if (existingMatricula) {
          const currentMatriculaPayload = {
            id_curso: existingMatricula.id_curso,
            fecha_matricula: existingMatricula.fecha_matricula ? existingMatricula.fecha_matricula.toISOString().slice(0, 10) : null,
            fecha_inscripcion: existingMatricula.fecha_inscripcion ? existingMatricula.fecha_inscripcion.toISOString().slice(0, 10) : null,
            fecha_retiro: existingMatricula.fecha_retiro ? existingMatricula.fecha_retiro.toISOString().slice(0, 10) : null,
            alumno_nuevo: existingMatricula.alumno_nuevo,
            repetidor: existingMatricula.repetidor
          };

          const updates = [];
          const values = [];

          Object.entries(incomingMatriculaPayload).forEach(([key, value]) => {
            const currentValue = currentMatriculaPayload[key] ?? null;
            const nextValue = value;
            if (valuesAreDifferent(currentValue, nextValue)) {
              updates.push(`${key} = $${updates.length + 1}`);
              values.push(nextValue);
            }
          });

          if (updates.length) {
            await client.query(
              `UPDATE matricula SET ${updates.join(', ')} WHERE id_matricula = $${updates.length + 1}`,
              [...values, existingMatricula.id_matricula]
            );
            rowChanged = true;
          }
        }

        const changedPago = await upsertSimpleByAlumno(client, 'pago', 'id_pago', idAlumno, {
          forma_pago: toNullable(normalized.formapago),
          banco: toNullable(normalized.banco),
          tipo_cuenta: toNullable(normalized.tipoCuenta),
          numero_cuenta: toNullable(normalized.numeroCuenta)
        });
        if (changedPago) rowChanged = true;

        const changedApoyo = await upsertSimpleByAlumno(client, 'programa_apoyo', 'id_programa', idAlumno, {
          vulnerable: normalized.vulnerable === null ? false : normalized.vulnerable,
          prioritario: normalized.prioritario === null ? false : normalized.prioritario,
          preferente: normalized.preferente === null ? false : normalized.preferente,
          pro_retencion: normalized.proRetencion === null ? false : normalized.proRetencion
        });
        if (changedApoyo) rowChanged = true;

        const changedSalud = await upsertSimpleByAlumno(client, 'salud', 'id_salud', idAlumno, {
          asma: normalized.asma === null ? false : normalized.asma,
          diabetes: normalized.diabetes === null ? false : normalized.diabetes,
          epilepsia: normalized.epilepsia === null ? false : normalized.epilepsia,
          observaciones: toNullable(normalized.observacionesSalud)
        });
        if (changedSalud) rowChanged = true;

        const changedEmergencia = await upsertSimpleByAlumno(client, 'emergencia', 'id_emergencia', idAlumno, {
          avisar_a: toNullable(normalized.avisarA),
          telefono_emergencia: toNullable(normalized.telefonoEmergencia),
          trasladar_a: toNullable(normalized.trasladarA)
        });
        if (changedEmergencia) rowChanged = true;

        if (normalized.beneficiarioActivo !== null) {
          const changedBenef = await upsertSimpleByAlumno(client, 'beneficiario_alimentacion', 'id_beneficiario', idAlumno, {
            activo: normalized.beneficiarioActivo
          });
          if (changedBenef) rowChanged = true;
        }

        if (normalized.alergiaMedicamentos) {
          const restrictionText = `Alergia medicamentos: ${normalized.alergiaMedicamentos}`;
          const existingRestriction = await client.query(
            `
              SELECT id_restriccion
              FROM restriccion_dietaria
              WHERE id_alumno = $1 AND vigente = true AND LOWER(descripcion) = LOWER($2)
              LIMIT 1
            `,
            [idAlumno, restrictionText]
          );
          if (existingRestriction.rows.length === 0) {
            await client.query(
              'INSERT INTO restriccion_dietaria (id_alumno, descripcion, vigente) VALUES ($1, $2, true)',
              [idAlumno, restrictionText]
            );
            rowChanged = true;
          }
        }

        for (const contact of normalized.contactos) {
          const roleKey = normalizeKeyword(contact.role);
          const isApoderado = roleKey.includes('apoderado');
          const relationChanged = await ensureContactAndRelation(client, idAlumno, contact, {
            tipo_relacion: contact.role,
            autoriza_foto: isApoderado ? (normalized.autorizaFotoApoderado ?? false) : false,
            es_contacto_principal: roleKey === 'apoderado',
            vive_con_alumno: false
          });

          if (relationChanged) rowChanged = true;
        }

        if (!existing) {
          summary.inserted++;
        } else if (rowChanged) {
          summary.updated++;
        } else {
          summary.unchanged++;
        }
      } catch (rowError) {
        summary.errors.push({ row: excelRowNumber, message: rowError.message });
      }
    }

    await client.query('COMMIT');
    res.json(summary);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ message: 'Error al sincronizar estudiantes.' });
  } finally {
    client.release();
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
