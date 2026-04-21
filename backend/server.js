const express = require('express');
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { verifyToken, verifyRole, JWT_SECRET } = require('./middleware/auth');

const app = express();
// Configuracion de CORS vital para aceptar cookies del puerto de React
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

const PORT = process.env.PORT || 5000;

const bootstrapBaseSchema = async () => {
  const alumnoExists = await pool.query("SELECT to_regclass('public.alumno') AS exists");
  if (alumnoExists.rows[0]?.exists) return false;

  const initSqlPath = path.join(__dirname, 'init.sql');
  const initSql = fs.readFileSync(initSqlPath, 'utf8');

  console.log('No se detectó el esquema base. Aplicando init.sql...');
  await pool.query(initSql);
  console.log('Esquema base creado correctamente.');
  return true;
};

const ensureDefaultUsers = async () => {
  console.log('Verificando usuarios por defecto...');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('1234', salt);

  await pool.query(
    "INSERT INTO usuarios (correo, password_hash, rol) VALUES ($1, $2, 'lector') ON CONFLICT (correo) DO NOTHING",
    ['lector@colegio.cl', hash]
  );

  await pool.query(
    "INSERT INTO usuarios (correo, password_hash, rol) VALUES ($1, $2, 'admin') ON CONFLICT (correo) DO NOTHING",
    ['admin@colegio.cl', hash]
  );
};

const ensureExcelSnapshotTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumno_excel_snapshot (
      id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
      raw_payload JSONB NOT NULL,
      fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};

const ensureExcelDerivedTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumno_complemento (
      id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
      lista VARCHAR(50),
      estado VARCHAR(50),
      foto VARCHAR(255),
      condicionalidad VARCHAR(100),
      nacionalidad VARCHAR(100),
      religion VARCHAR(100),
      opta_religion BOOLEAN,
      cursos_repetidos VARCHAR(100),
      colegio_procedencia VARCHAR(150),
      retira_titular VARCHAR(100),
      retira_suplente VARCHAR(100),
      centro_costo VARCHAR(50),
      diagnostico_pie BOOLEAN,
      diagnostico_pie_escuela_lenguaje BOOLEAN,
      pie_tipo_discapacidad BOOLEAN,
      tx_etnia_indigena VARCHAR(100),
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS persona_contacto_detalle (
      id_persona INT PRIMARY KEY REFERENCES persona_contacto(id_persona) ON DELETE CASCADE,
      fecha_nacimiento DATE,
      comuna VARCHAR(100),
      empresa VARCHAR(150),
      telefono_empresa VARCHAR(50),
      estudios VARCHAR(150),
      profesion VARCHAR(150),
      nacionalidad VARCHAR(100),
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pago_detalle (
      id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
      co_banco VARCHAR(50),
      nu_tarjeta_bancaria VARCHAR(50),
      fe_vencimiento_tarjeta DATE,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS salud_detalle (
      id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
      peso VARCHAR(50),
      talla VARCHAR(50),
      grupo_sangre VARCHAR(10),
      problemas_visuales BOOLEAN,
      problemas_auditivos BOOLEAN,
      problemas_cardiacos BOOLEAN,
      problemas_columna BOOLEAN,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS emergencia_detalle (
      id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
      seguro VARCHAR(100),
      isapre VARCHAR(100),
      tx_obs_emergencia TEXT,
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS beneficiario_alimentacion (
      id_beneficiario SERIAL PRIMARY KEY,
      id_alumno INT NOT NULL REFERENCES alumno(id_alumno) ON DELETE CASCADE,
      activo BOOLEAN NOT NULL DEFAULT true,
      fecha_inicio DATE,
      fecha_fin DATE,
      motivo_ingreso VARCHAR(255),
      fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`ALTER TABLE beneficiario_alimentacion ALTER COLUMN id_alumno SET NOT NULL`);
  await pool.query(`ALTER TABLE beneficiario_alimentacion ALTER COLUMN activo SET NOT NULL`);

  // Compatibilidad hacia adelante: evita fallos por textos largos al importar desde Excel.
  await pool.query(`ALTER TABLE alumno ALTER COLUMN sexo TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE alumno ALTER COLUMN telefono TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE persona_contacto ALTER COLUMN telefono TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE persona_contacto_detalle ALTER COLUMN telefono_empresa TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE alumno_complemento ALTER COLUMN foto TYPE VARCHAR(255)`);
  await pool.query(`ALTER TABLE salud_detalle ALTER COLUMN peso TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE salud_detalle ALTER COLUMN talla TYPE VARCHAR(50)`);
  await pool.query(`ALTER TABLE emergencia ALTER COLUMN telefono_emergencia TYPE VARCHAR(50)`);
};

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

const hasIncomingValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

const parseBenefitActive = (value) => {
  const str = String(value).trim();
  
  // Si es solo números puros, ignorar (es número de lista del curso, no beneficiario)
  if (/^\d+$/.test(str)) return null;
  
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
  const fechaNacimiento = normalizeDateInput(pickRowValue(row, [`Fecha_nac_${prefix}`, `Fecha nacimiento_${prefix}`, `Fecha_nacimiento_${prefix}`]));
  const comuna = pickRowValue(row, [`Comuna_${prefix}`, `${prefix}_comuna`, `comuna ${prefix}`]);
  const empresa = pickRowValue(row, [`Empresa_${prefix}`, `${prefix}_empresa`]);
  const telefonoEmpresa = pickRowValue(row, [`Telefono_empresa_${prefix}`, `Teléfono_empresa_${prefix}`, `${prefix}_telefono_empresa`]);
  const estudios = pickRowValue(row, [`Estudios_${prefix}`, `${prefix}_estudios`]);
  const profesion = pickRowValue(row, [`Profesion_${prefix}`, `Profesión_${prefix}`, `${prefix}_profesion`]);
  const nacionalidad = pickRowValue(row, [`nacionalidad_${prefix}`, `Nacionalidad_${prefix}`, `${prefix}_nacionalidad`]);

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
    direccion,
    detail: {
      fecha_nacimiento: fechaNacimiento,
      comuna: comuna || null,
      empresa: empresa || null,
      telefono_empresa: telefonoEmpresa || null,
      estudios: estudios || null,
      profesion: profesion || null,
      nacionalidad: nacionalidad || null
    }
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
    if (!hasIncomingValue(nextVal)) return false;
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

const upsertSimpleByOwner = async (client, tableName, ownerFieldName, ownerId, payload) => {
  const keys = Object.keys(payload);
  if (!keys.length) return false;

  const existingRes = await client.query(
    `SELECT ${ownerFieldName}, ${keys.join(', ')} FROM ${tableName} WHERE ${ownerFieldName} = $1 LIMIT 1`,
    [ownerId]
  );
  const existing = existingRes.rows[0];

  if (!existing) {
    const values = keys.map((key) => payload[key]);
    const columns = [ownerFieldName, ...keys];
    const placeholders = columns.map((_, idx) => `$${idx + 1}`);
    await client.query(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`,
      [ownerId, ...values]
    );
    return true;
  }

  const changedKeys = keys.filter((key) => {
    const nextVal = payload[key] ?? null;
    if (!hasIncomingValue(nextVal)) return false;
    const currVal = existing[key] ?? null;
    return valuesAreDifferent(currVal, nextVal);
  });

  if (!changedKeys.length) return false;

  const setClause = changedKeys.map((key, idx) => `${key} = $${idx + 1}`).join(', ');
  const updateValues = changedKeys.map((key) => payload[key]);
  await client.query(
    `UPDATE ${tableName} SET ${setClause} WHERE ${ownerFieldName} = $${changedKeys.length + 1}`,
    [...updateValues, ownerId]
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

  contact.personaId = idPersona;

  return changed;
};

const parseStudentRow = (row) => {
  const rutValue = pickRowValue(row, ['rut', 'run', 'rut alumno', 'run alumno', 'id alumno']);
  const dvValue = pickRowValue(row, ['dv', 'digito verificador', 'digito', 'verificador']);
  const { rut, dv } = normalizeRutAndDv(rutValue, dvValue);

  const matricula = pickRowValue(row, ['matr.', 'matr', 'matricula', 'matrícula', 'n matricula', 'n matricula alumno']);
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

  const codigoBarra = pickRowValue(row, ['codigo_barra', 'codigo barra', 'barcode', 'codigo tarjeta', 'id tarjeta', 'codigo qr', 'qr']);

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
  const beneficiarioFechaInicio = normalizeDateInput(pickRowValue(row, ['fecha_inicio_beneficio', 'fecha inicio beneficio', 'inicio beneficio']));
  const beneficiarioFechaFin = normalizeDateInput(pickRowValue(row, ['fecha_fin_beneficio', 'fecha fin beneficio', 'fin beneficio']));
  const beneficiarioMotivo = pickRowValue(row, ['motivo_ingreso', 'motivo ingreso', 'motivo beneficio']);

  const alergiaMedicamentos = pickRowValue(row, ['alergia_medicamentos', 'alergia medicamentos']);
  const restriccionDietariaRaw = pickRowValue(row, ['restriccion_dietaria', 'restricciones dietarias', 'restricciones', 'alergia alimentos', 'alergias alimentarias']);
  const restriccionDietaria = restriccionDietariaRaw
    .split(/[;,|]/)
    .map((item) => sanitizeText(item))
    .filter(Boolean);

  const listaRaw = pickRowValue(row, ['lista']);
  const estadoRaw = pickRowValue(row, ['estado']);
  const fotoRaw = pickRowValue(row, ['foto']);
  const condicionalidad = pickRowValue(row, ['condicionalidad']);
  const nacionalidad = pickRowValue(row, ['nacionalidad']);
  const religion = pickRowValue(row, ['religion', 'religión']);
  const optaReligion = toBooleanOrNull(pickRowValue(row, ['opta religion', 'opta_religion', 'opta religión']));
  const cursosRepetidos = pickRowValue(row, ['cursos_repetidos']);
  const colegioProcedencia = pickRowValue(row, ['colegio_proc']);
  const retiraTitular = pickRowValue(row, ['retira_titular']);
  const retiraSuplente = pickRowValue(row, ['retira_suplente']);
  const centroCosto = pickRowValue(row, ['centro_costo']);
  const diagnosticoPie = toBooleanOrNull(pickRowValue(row, ['diagnostico_pie']));
  const diagnosticoPieEscuelaLenguaje = toBooleanOrNull(pickRowValue(row, ['diagnostico_pie_escuela_lenguaje']));
  const pieTipoDiscapacidad = toBooleanOrNull(pickRowValue(row, ['pie_tipo_discapacidad']));
  const txEtniaIndigena = pickRowValue(row, ['tx_etnia_indigena']);

  const peso = pickRowValue(row, ['peso']);
  const talla = pickRowValue(row, ['talla']);
  const grupoSangre = pickRowValue(row, ['grupo_sangre']);
  const problemasVisuales = toBooleanOrNull(pickRowValue(row, ['problemas_visuales']));
  const problemasAuditivos = toBooleanOrNull(pickRowValue(row, ['problemas_auditivos']));
  const problemasCardiacos = toBooleanOrNull(pickRowValue(row, ['problemas_cardiacos']));
  const problemasColumna = toBooleanOrNull(pickRowValue(row, ['problemas_columna']));

  const seguro = pickRowValue(row, ['seguro']);
  const isapre = pickRowValue(row, ['isapre']);
  const observacionEmergencia = pickRowValue(row, ['tx_obs_emergencia']);

  const coBanco = pickRowValue(row, ['co_banco']);
  const nuTarjetaBancaria = pickRowValue(row, ['nu_tarjeta_bancaria']);
  const feVencimientoTarjeta = normalizeDateInput(pickRowValue(row, ['fe_vencimiento_tarjeta']));

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
    codigoBarra,
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
    beneficiarioFechaInicio,
    beneficiarioFechaFin,
    beneficiarioMotivo,
    alergiaMedicamentos,
    restriccionDietaria,
    complemento: {
      lista: listaRaw || null,
      estado: estadoRaw || null,
      foto: fotoRaw || null,
      condicionalidad: condicionalidad || null,
      nacionalidad: nacionalidad || null,
      religion: religion || null,
      opta_religion: optaReligion,
      cursos_repetidos: cursosRepetidos || null,
      colegio_procedencia: colegioProcedencia || null,
      retira_titular: retiraTitular || null,
      retira_suplente: retiraSuplente || null,
      centro_costo: centroCosto || null,
      diagnostico_pie: diagnosticoPie,
      diagnostico_pie_escuela_lenguaje: diagnosticoPieEscuelaLenguaje,
      pie_tipo_discapacidad: pieTipoDiscapacidad,
      tx_etnia_indigena: txEtniaIndigena || null
    },
    saludDetalle: {
      peso: peso || null,
      talla: talla || null,
      grupo_sangre: grupoSangre || null,
      problemas_visuales: problemasVisuales,
      problemas_auditivos: problemasAuditivos,
      problemas_cardiacos: problemasCardiacos,
      problemas_columna: problemasColumna
    },
    emergenciaDetalle: {
      seguro: seguro || null,
      isapre: isapre || null,
      tx_obs_emergencia: observacionEmergencia || null
    },
    pagoDetalle: {
      co_banco: coBanco || null,
      nu_tarjeta_bancaria: nuTarjetaBancaria || null,
      fe_vencimiento_tarjeta: feVencimientoTarjeta || null
    },
    contactos,
    autorizaFotoApoderado,
    fechaActualizacion
  };
};

const parseBeneficiaryImportMonth = (monthValue) => {
  const cleaned = sanitizeText(monthValue);
  if (!cleaned) return null;

  const match = cleaned.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return null;

  const lastDay = new Date(Date.UTC(year, month, 0));
  return {
    year,
    month,
    monthKey: `${year}-${String(month).padStart(2, '0')}`,
    firstDay: `${year}-${String(month).padStart(2, '0')}-01`,
    lastDay: lastDay.toISOString().slice(0, 10),
    daysInMonth: lastDay.getUTCDate()
  };
};

const isTruthyExcelMark = (value) => {
  const normalized = sanitizeText(value).toLowerCase();
  if (!normalized) return false;
  return !['0', 'no', 'n', 'false', '-'].includes(normalized);
};

const resolveBeneficiaryStudent = async (client, row) => {
  const directId = parseInt(row.id_alumno ?? row.idAlumno ?? row.alumno_id, 10);
  if (Number.isInteger(directId) && directId > 0) {
    const byId = await client.query(
      `
        SELECT a.id_alumno, a.rut, a.nombres, a.paterno, a.materno, a.email, c.nombre_curso
        FROM alumno a
        LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
        LEFT JOIN curso c ON m.id_curso = c.id_curso
        WHERE a.id_alumno = $1
        LIMIT 1
      `,
      [directId]
    );
    if (byId.rows[0]) return byId.rows[0];
  }

  const rut = sanitizeText(row.rut || row.RUT || row.run || row['rut alumno'] || row['run alumno']).replace(/[.\s]/g, '');
  if (rut) {
    const byRut = await client.query(
      `
        SELECT a.id_alumno, a.rut, a.nombres, a.paterno, a.materno, a.email, c.nombre_curso
        FROM alumno a
        LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
        LEFT JOIN curso c ON m.id_curso = c.id_curso
        WHERE REPLACE(LOWER(a.rut), '-', '') = REPLACE(LOWER($1), '-', '')
        LIMIT 1
      `,
      [rut]
    );
    if (byRut.rows[0]) return byRut.rows[0];
  }

  const email = sanitizeText(row.email || row.correo || row.mail);
  if (email) {
    const byEmail = await client.query(
      `
        SELECT a.id_alumno, a.rut, a.nombres, a.paterno, a.materno, a.email, c.nombre_curso
        FROM alumno a
        LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
        LEFT JOIN curso c ON m.id_curso = c.id_curso
        WHERE LOWER(a.email) = LOWER($1)
        LIMIT 1
      `,
      [email]
    );
    if (byEmail.rows[0]) return byEmail.rows[0];
  }

  const barcode = sanitizeText(row.codigo_barra || row.codigoBarra || row.barcode);
  if (barcode) {
    const byBarcode = await client.query(
      `
        SELECT a.id_alumno, a.rut, a.nombres, a.paterno, a.materno, a.email, c.nombre_curso
        FROM alumno a
        LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
        LEFT JOIN curso c ON m.id_curso = c.id_curso
        WHERE LOWER(a.codigo_barra) = LOWER($1)
        LIMIT 1
      `,
      [barcode]
    );
    if (byBarcode.rows[0]) return byBarcode.rows[0];
  }

  const nombres = sanitizeText(row.nombre || row.nombres || row.name);
  const apellidos = sanitizeText(row.apellidos || row.apellido || row.paterno);
  const curso = sanitizeText(row.curso || row.grade || row.nombre_curso);

  if (!nombres || !apellidos) return null;

  const params = [nombres, apellidos];
  let courseClause = '';
  if (curso) {
    params.push(curso);
    courseClause = ' AND LOWER(COALESCE(c.nombre_curso, \'\')) = LOWER($3) ';
  }

  const byName = await client.query(
    `
      SELECT a.id_alumno, a.rut, a.nombres, a.paterno, a.materno, a.email, c.nombre_curso
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE LOWER(a.nombres) = LOWER($1)
        AND LOWER(TRIM(CONCAT_WS(' ', a.paterno, COALESCE(a.materno, '')))) = LOWER($2)
        ${courseClause}
      ORDER BY a.id_alumno ASC
      LIMIT 1
    `,
    params
  );

  return byName.rows[0] || null;
};

const upsertBeneficiaryRecord = async (client, idAlumno, payload) => {
  const existingRes = await client.query(
    `
      SELECT id_beneficiario, id_alumno, activo, fecha_inicio, fecha_fin, motivo_ingreso
      FROM beneficiario_alimentacion
      WHERE id_alumno = $1
      LIMIT 1
    `,
    [idAlumno]
  );

  const existing = existingRes.rows[0];
  if (!existing) {
    const inserted = await client.query(
      `
        INSERT INTO beneficiario_alimentacion (id_alumno, activo, fecha_inicio, fecha_fin, motivo_ingreso)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `,
      [idAlumno, payload.activo, payload.fecha_inicio, payload.fecha_fin, payload.motivo_ingreso]
    );
    return { action: 'inserted', row: inserted.rows[0] };
  }

  const nextPayload = {
    activo: payload.activo,
    fecha_inicio: payload.fecha_inicio,
    fecha_fin: payload.fecha_fin,
    motivo_ingreso: payload.motivo_ingreso
  };

  const changedKeys = Object.keys(nextPayload).filter((key) => valuesAreDifferent(existing[key], nextPayload[key]));
  if (changedKeys.length === 0) {
    return { action: 'unchanged', row: existing };
  }

  const setClause = changedKeys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const values = changedKeys.map((key) => nextPayload[key]);
  const updated = await client.query(
    `
      UPDATE beneficiario_alimentacion
      SET ${setClause}
      WHERE id_beneficiario = $${changedKeys.length + 1}
      RETURNING *
    `,
    [...values, existing.id_beneficiario]
  );

  return { action: 'updated', row: updated.rows[0] };
};

const importLunchRegistrationsFromBeneficiaries = async (client, idAlumno, monthInfo, mealMarks) => {
  let inserted = 0;
  let skipped = 0;

  for (const meal of mealMarks) {
    if (!meal || !meal.date || !meal.tipo_alimentacion) continue;

    const existing = await client.query(
      `
        SELECT id_registro
        FROM lunch_registrations
        WHERE id_alumno = $1
          AND fecha_entrega = $2
          AND LOWER(tipo_alimentacion) = LOWER($3)
        LIMIT 1
      `,
      [idAlumno, meal.date, meal.tipo_alimentacion]
    );

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await client.query(
      `
        INSERT INTO lunch_registrations (id_alumno, fecha_entrega, tipo_alimentacion, es_beneficiario_al_momento)
        VALUES ($1, $2, $3, true)
      `,
      [idAlumno, meal.date, meal.tipo_alimentacion.toLowerCase()]
    );
    inserted++;
  }

  return { inserted, skipped, month: monthInfo.monthKey };
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

// === BÚSQUEDA INTELIGENTE (Lector o Admin) ===
// Busca por RUT parcial, código de barra, o nombre. Máximo 10 resultados.
app.get('/api/students/search', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);

  const term = q.trim();

  try {
    // Detectar si parece RUT (tiene números y puede tener puntos/guión)
    const cleanedRut = term.replace(/\./g, '').replace(/-/g, '');
    const looksLikeRut = /^\d{1,9}$/.test(cleanedRut);

    let query, params;

    if (looksLikeRut) {
      // Buscar por RUT parcial o código de barra
      query = `
        SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.codigo_barra, c.nombre_curso
        FROM alumno a
        LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
        LEFT JOIN curso c ON m.id_curso = c.id_curso
        WHERE a.activo = true
          AND (a.rut LIKE $1 OR a.codigo_barra LIKE $1)
        ORDER BY a.paterno, a.nombres
        LIMIT 10
      `;
      params = [`%${cleanedRut}%`];
    } else {
      // Buscar por nombre (paterno, materno o nombres) — ILIKE para case-insensitive
      const searchTerm = `%${term}%`;
      query = `
        SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.codigo_barra, c.nombre_curso
        FROM alumno a
        LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
        LEFT JOIN curso c ON m.id_curso = c.id_curso
        WHERE a.activo = true
          AND (
            a.nombres ILIKE $1
            OR a.paterno ILIKE $1
            OR a.materno ILIKE $1
            OR CONCAT(a.nombres, ' ', a.paterno, ' ', a.materno) ILIKE $1
          )
        ORDER BY a.paterno, a.nombres
        LIMIT 10
      `;
      params = [searchTerm];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error en búsqueda' });
  }
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

    // REVISAR FECHAS DE BENEFICIO: Valida activo + ventana de tiempo
    const queryBenef = `
      SELECT activo, fecha_inicio, fecha_fin, motivo_ingreso
      FROM beneficiario_alimentacion 
      WHERE id_alumno = $1 
        AND activo = true
    `;
    const resBenef = await pool.query(queryBenef, [alumno.id_alumno]);
    const esBeneficiario = resBenef.rows.length > 0;
    const beneficioDetalle = resBenef.rows[0] || null;

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
      beneficioDetalle,
      restricciones,
      alreadyRegistered 
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error del servidor');
  }
});

// === STATUS DE ALUMNO POR ID (para selección manual desde búsqueda) ===
app.get('/api/students/:id/status', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  const { id } = req.params;
  const { tipo_alimentacion } = req.query;
  const tipoAlimentacionNormalizado = (tipo_alimentacion || '').toString().trim().toLowerCase();

  try {
    const queryAlumno = `
      SELECT a.id_alumno, a.nombres, a.paterno, a.materno, a.rut, a.dv, a.activo as alumno_activo, c.nombre_curso
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      WHERE a.id_alumno = $1
    `;
    const resultAlumno = await pool.query(queryAlumno, [id]);
    if (resultAlumno.rows.length === 0) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }
    const alumno = resultAlumno.rows[0];

    if (!alumno.alumno_activo) {
      return res.status(403).json({ message: 'Alumno Inactivo en el sistema. Prohibido registrar consumos.', alumno_inactivo: true });
    }

    const queryBenef = `
      SELECT activo, fecha_inicio, fecha_fin, motivo_ingreso
      FROM beneficiario_alimentacion 
      WHERE id_alumno = $1 AND activo = true
    `;
    const resBenef = await pool.query(queryBenef, [alumno.id_alumno]);
    const esBeneficiario = resBenef.rows.length > 0;
    const beneficioDetalle = resBenef.rows[0] || null;

    const queryRestric = `SELECT descripcion FROM restriccion_dietaria WHERE id_alumno = $1 AND vigente = true`;
    const resRestric = await pool.query(queryRestric, [alumno.id_alumno]);
    const restricciones = resRestric.rows.map(r => r.descripcion);

    let alreadyRegistered = false;
    if (tipoAlimentacionNormalizado) {
      const queryCheck = `
        SELECT id_registro FROM lunch_registrations 
        WHERE id_alumno = $1 AND LOWER(tipo_alimentacion) = $2 AND fecha_entrega = CURRENT_DATE
      `;
      const resCheck = await pool.query(queryCheck, [alumno.id_alumno, tipoAlimentacionNormalizado]);
      alreadyRegistered = resCheck.rows.length > 0;
    }

    res.json({ alumno, esBeneficiario, beneficioDetalle, restricciones, alreadyRegistered });
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

    // Protección contra duplicados: verificar si ya existe registro hoy
    const queryDupCheck = `
      SELECT id_registro FROM lunch_registrations 
      WHERE id_alumno = $1 AND LOWER(tipo_alimentacion) = $2 AND fecha_entrega = CURRENT_DATE
    `;
    const resDup = await pool.query(queryDupCheck, [id_alumno, tipoAlimentacionNormalizado]);
    if (resDup.rows.length > 0) {
      return res.status(409).json({ message: 'Ya registrado para hoy', duplicate: true });
    }

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

// (Ruta duplicada eliminada — la búsqueda principal está arriba en /api/students/search)

// === CONTADOR DE REGISTROS DEL DÍA (para vista kiosco) ===
app.get('/api/lunches/today-count', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`SELECT COUNT(*) as total FROM lunch_registrations WHERE fecha_entrega = CURRENT_DATE`);
    res.json({ total: parseInt(result.rows[0].total, 10) });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

// === STATS DEL DÍA (total + beneficiarios) ===
app.get('/api/lunches/today-stats', verifyToken, verifyRole(['lector', 'admin']), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE es_beneficiario_al_momento = true) as beneficiarios,
        COUNT(*) FILTER (WHERE es_beneficiario_al_momento = false OR es_beneficiario_al_momento IS NULL) as no_beneficiarios
      FROM lunch_registrations 
      WHERE fecha_entrega = CURRENT_DATE
    `);
    const row = result.rows[0];
    res.json({
      total: parseInt(row.total, 10),
      beneficiarios: parseInt(row.beneficiarios, 10),
      noBeneficiarios: parseInt(row.no_beneficiarios, 10)
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error' });
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
      SELECT a.id_alumno as id, a.rut, a.nombres || ' ' || a.paterno as name, c.nombre_curso as grade, a.activo,
        COALESCE(b.activo, false) as es_beneficiario
      FROM alumno a
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      LEFT JOIN beneficiario_alimentacion b ON a.id_alumno = b.id_alumno
      ORDER BY a.id_alumno ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch(err) {
    console.error(err.message);
    res.status(500).send('Error');
  }
});

app.get('/api/admin/beneficiarios', verifyToken, verifyRole(['admin']), async (req, res) => {
  try {
    const query = `
      WITH beneficiarios_ordenados AS (
        SELECT DISTINCT ON (b.id_alumno)
          b.id_beneficiario,
          b.id_alumno,
          b.activo,
          b.fecha_inicio,
          b.fecha_fin,
          b.motivo_ingreso,
          b.fecha_registro
        FROM beneficiario_alimentacion b
        ORDER BY b.id_alumno, b.fecha_registro DESC, b.id_beneficiario DESC
      )
      SELECT
        bo.id_beneficiario,
        bo.id_alumno,
        bo.activo,
        bo.fecha_inicio,
        bo.fecha_fin,
        bo.motivo_ingreso,
        bo.fecha_registro,
        a.rut,
        a.nombres,
        a.paterno,
        a.materno,
        a.email,
        a.activo AS alumno_activo,
        c.nombre_curso
      FROM beneficiarios_ordenados bo
      JOIN alumno a ON bo.id_alumno = a.id_alumno
      LEFT JOIN matricula m ON a.id_alumno = m.id_alumno
      LEFT JOIN curso c ON m.id_curso = c.id_curso
      ORDER BY a.paterno ASC, a.nombres ASC, bo.fecha_registro DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Error al obtener beneficiarios.' });
  }
});

app.post('/api/admin/beneficiarios', verifyToken, verifyRole(['admin']), async (req, res) => {
  const idAlumno = parseInt(req.body?.id_alumno ?? req.body?.idAlumno, 10);
  const activo = toBooleanOrNull(req.body?.activo);
  const fechaInicio = normalizeDateInput(req.body?.fecha_inicio ?? req.body?.fechaInicio);
  const motivoIngreso = toNullable(req.body?.motivo_ingreso ?? req.body?.motivoIngreso);

  if (!Number.isInteger(idAlumno) || idAlumno <= 0 || activo === null) {
    return res.status(400).json({ message: 'Faltan datos obligatorios para beneficiarios.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const alumnoRes = await client.query('SELECT id_alumno FROM alumno WHERE id_alumno = $1 LIMIT 1', [idAlumno]);
    if (alumnoRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Alumno no encontrado.' });
    }

    const result = await upsertBeneficiaryRecord(client, idAlumno, {
      activo,
      fecha_inicio: fechaInicio,
      fecha_fin: null,
      motivo_ingreso: motivoIngreso
    });

    await client.query('COMMIT');
    res.json({ message: 'Beneficiario guardado correctamente.', beneficiario: result.row, action: result.action });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ message: 'Error al guardar beneficiario.' });
  } finally {
    client.release();
  }
});

app.post('/api/admin/beneficiarios/import', verifyToken, verifyRole(['admin']), async (req, res) => {
  const monthInfo = parseBeneficiaryImportMonth(req.body?.month);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const defaultActivoValue = toBooleanOrNull(req.body?.defaultActivo);
  const defaultActivo = defaultActivoValue === null ? true : defaultActivoValue;

  console.log(`[beneficiarios/import] Inicio importacion mes=${req.body?.month || 'N/D'} filas=${rows.length}`);

  if (!monthInfo) {
    return res.status(400).json({ message: 'Debes indicar un mes válido con formato AAAA-MM.' });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'No se recibieron filas para importar.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const summary = {
      total: rows.length,
      beneficiarios_insertados: 0,
      beneficiarios_actualizados: 0,
      beneficiarios_sin_cambios: 0,
      colaciones_insertadas: 0,
      colaciones_omitidas: 0,
      warnings: [],
      errors: []
    };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      const excelRowNumber = row.sourceRow || index + 2;
      const rowSavepoint = `benef_import_row_${index}`;
      await client.query(`SAVEPOINT ${rowSavepoint}`);

      try {
        const alumno = await resolveBeneficiaryStudent(client, row);
        if (!alumno) {
          console.error(
            `[beneficiarios/import] Fila ${excelRowNumber}: no se pudo identificar alumno`,
            {
              id_alumno: row.id_alumno || row.idAlumno || row.alumno_id || null,
              rut: row.rut || null,
              nombre: row.nombre || row.nombres || null,
              apellidos: row.apellidos || row.paterno || null,
              curso: row.curso || row.grade || null,
              email: row.email || row.correo || null
            }
          );
          summary.errors.push({ row: excelRowNumber, message: 'No se pudo identificar al alumno en la base de datos.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        const rowActive = toBooleanOrNull(row.activo);
        const activo = rowActive === null ? defaultActivo : rowActive;
        const beneficiaryResult = await upsertBeneficiaryRecord(client, alumno.id_alumno, {
          activo,
          fecha_inicio: normalizeDateInput(row.fecha_inicio ?? row.fechaInicio) || monthInfo.firstDay,
          fecha_fin: null,
          motivo_ingreso: toNullable(row.motivo_ingreso ?? row.motivoIngreso)
        });

        if (beneficiaryResult.action === 'inserted') summary.beneficiarios_insertados++;
        else if (beneficiaryResult.action === 'updated') summary.beneficiarios_actualizados++;
        else summary.beneficiarios_sin_cambios++;

        const mealMarks = [];
        const normalizedMeals = Array.isArray(row.meals) ? row.meals : [];

        for (const meal of normalizedMeals) {
          const day = parseInt(meal.day, 10);
          if (!Number.isInteger(day) || day < 1 || day > monthInfo.daysInMonth) continue;

          const date = `${monthInfo.monthKey}-${String(day).padStart(2, '0')}`;

          // Nuevo formato: cada marca ya llega normalizada como un registro con tipo_alimentacion.
          const mealType = sanitizeText(meal.tipo_alimentacion).toLowerCase();
          if (mealType === 'desayuno' || mealType === 'almuerzo') {
            mealMarks.push({ date, tipo_alimentacion: mealType });
            continue;
          }

          // Compatibilidad con formato anterior (columnas desayuno/almuerzo booleanas).
          if (isTruthyExcelMark(meal.desayuno)) mealMarks.push({ date, tipo_alimentacion: 'desayuno' });
          if (isTruthyExcelMark(meal.almuerzo)) mealMarks.push({ date, tipo_alimentacion: 'almuerzo' });
        }

        if (mealMarks.length > 0) {
          if (!activo) {
            console.warn(`[beneficiarios/import] Fila ${excelRowNumber}: beneficiario inactivo, se omiten colaciones retroactivas`);
            summary.warnings.push({ row: excelRowNumber, message: 'El beneficiario quedó inactivo y no se generaron colaciones retroactivas.' });
          } else {
            const mealResult = await importLunchRegistrationsFromBeneficiaries(client, alumno.id_alumno, monthInfo, mealMarks);
            summary.colaciones_insertadas += mealResult.inserted;
            summary.colaciones_omitidas += mealResult.skipped;
          }
        }

        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
      } catch (rowError) {
        await client.query(`ROLLBACK TO SAVEPOINT ${rowSavepoint}`);
        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
        console.error(`[beneficiarios/import] Fila ${excelRowNumber}: error inesperado`, rowError);
        summary.errors.push({ row: excelRowNumber, message: rowError.message });
      }
    }

    await client.query('COMMIT');
    console.log('[beneficiarios/import] Resumen', {
      total: summary.total,
      insertados: summary.beneficiarios_insertados,
      actualizados: summary.beneficiarios_actualizados,
      sinCambios: summary.beneficiarios_sin_cambios,
      colacionesInsertadas: summary.colaciones_insertadas,
      colacionesOmitidas: summary.colaciones_omitidas,
      warnings: summary.warnings.length,
      errors: summary.errors.length
    });
    res.json(summary);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[beneficiarios/import] Error fatal', err);
    res.status(500).json({ message: 'Error al importar beneficiarios.' });
  } finally {
    client.release();
  }
});

// === IMPORTAR BENEFICIARIOS PAE (sin generar asistencias retroactivas) ===
app.post('/api/admin/beneficiarios/import-pae', verifyToken, verifyRole(['admin']), async (req, res) => {
  const monthInfo = parseBeneficiaryImportMonth(req.body?.month);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];

  console.log(`[beneficiarios/import-pae] Inicio importacion mes=${req.body?.month || 'N/D'} filas=${rows.length}`);

  if (!monthInfo) {
    return res.status(400).json({ message: 'Debes indicar un mes válido con formato AAAA-MM.' });
  }

  if (!rows.length) {
    return res.status(400).json({ message: 'No se recibieron filas para importar.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const summary = {
      total: rows.length,
      beneficiarios_insertados: 0,
      beneficiarios_actualizados: 0,
      beneficiarios_sin_cambios: 0,
      warnings: [],
      errors: []
    };

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index] || {};
      const excelRowNumber = row.sourceRow || index + 2;
      const rowSavepoint = `benef_pae_row_${index}`;
      await client.query(`SAVEPOINT ${rowSavepoint}`);

      try {
        // Parsear fila PAE: Nº DE RUN, APELLIDOS, NOMBRE, CURSO, %RSH
        const rutValue = toNullable(row.run || row['Nº DE RUN'] || row.rut);
        const dvValue = toNullable(row.dv || row['dv'] || row['DV']);
        const apellidosValue = toNullable(row.apellidos || row.APELLIDOS || row.paterno);
        const nombreValue = toNullable(row.nombre || row.NOMBRE || row.nombres);
        const porcentajeValue = toNullable(row.porcentaje || row['%RSH'] || row.porciento);

        if (!rutValue) {
          summary.errors.push({ row: excelRowNumber, message: 'RUT vacío.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        const { rut, dv } = normalizeRutAndDv(rutValue, dvValue);
        if (!rut) {
          summary.errors.push({ row: excelRowNumber, message: 'RUT inválido.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        // Buscar alumno por RUT
        const studentRes = await client.query(
          'SELECT id_alumno, nombres, paterno, materno FROM alumno WHERE rut = $1 LIMIT 1',
          [rut]
        );

        if (studentRes.rows.length === 0) {
          // Alumno no existe - NO crear beneficiario, solo warning
          summary.warnings.push({ 
            row: excelRowNumber, 
            message: `Alumno con RUT ${rut} no existe en BD. Se omite importación como beneficiario.` 
          });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        const idAlumno = studentRes.rows[0].id_alumno;

        // Crear/actualizar beneficiario_alimentacion (SIN lunch_registrations)
        const beneficiaryResult = await upsertBeneficiaryRecord(client, idAlumno, {
          activo: true,
          fecha_inicio: monthInfo.firstDay,
          fecha_fin: null,
          motivo_ingreso: porcentajeValue ? `PAE ${porcentajeValue}` : 'PAE'
        });

        if (beneficiaryResult.action === 'inserted') summary.beneficiarios_insertados++;
        else if (beneficiaryResult.action === 'updated') summary.beneficiarios_actualizados++;
        else summary.beneficiarios_sin_cambios++;

        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
      } catch (rowError) {
        await client.query(`ROLLBACK TO SAVEPOINT ${rowSavepoint}`);
        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
        console.error(`[beneficiarios/import-pae] Fila ${excelRowNumber}: error`, rowError);
        summary.errors.push({ row: excelRowNumber, message: rowError.message });
      }
    }

    await client.query('COMMIT');
    console.log('[beneficiarios/import-pae] Resumen', {
      total: summary.total,
      insertados: summary.beneficiarios_insertados,
      actualizados: summary.beneficiarios_actualizados,
      sinCambios: summary.beneficiarios_sin_cambios,
      warnings: summary.warnings.length,
      errors: summary.errors.length
    });
    res.json(summary);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[beneficiarios/import-pae] Error fatal', err);
    res.status(500).json({ message: 'Error al importar beneficiarios PAE.' });
  } finally {
    client.release();
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
      const rowSavepoint = `students_sync_row_${index}`;
      await client.query(`SAVEPOINT ${rowSavepoint}`);

      try {
        const normalized = parseStudentRow(rows[index]);

        if (!normalized.rut) {
          summary.errors.push({ row: excelRowNumber, message: 'RUT vacío o inválido.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
          continue;
        }

        if (!normalized.nombres || !normalized.paterno) {
          summary.errors.push({ row: excelRowNumber, message: 'Faltan nombres o apellido paterno.' });
          await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
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
            await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
            continue;
          }

          if (dbStamp && dbStamp > normalized.fechaActualizacion) {
            summary.warnings.push(`Fila ${excelRowNumber}: Fecha_actualizacion en BD es mayor que Excel; se omite por seguridad.`);
            summary.unchanged++;
            await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
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
              INSERT INTO alumno (matricula, rut, dv, nombres, paterno, materno, fecha_nacimiento, sexo, email, telefono, direccion, codigo_barra, activo)
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
              normalized.codigoBarra || null,
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
          const nextStudentPayload = {
            matricula: hasIncomingValue(normalized.matricula) ? normalized.matricula : existing.matricula || null,
            dv: hasIncomingValue(normalized.dv) ? normalized.dv : existing.dv || null,
            nombres: hasIncomingValue(normalized.nombres) ? normalized.nombres : existing.nombres,
            paterno: hasIncomingValue(normalized.paterno) ? normalized.paterno : existing.paterno,
            materno: hasIncomingValue(normalized.materno) ? normalized.materno : (existing.materno || null),
            fecha_nacimiento: hasIncomingValue(normalized.fechaNacimiento) ? normalized.fechaNacimiento : (existing.fecha_nacimiento ? existing.fecha_nacimiento.toISOString().slice(0, 10) : null),
            sexo: hasIncomingValue(normalized.sexo) ? normalized.sexo : (existing.sexo || null),
            email: hasIncomingValue(normalized.email) ? normalized.email : (existing.email || null),
            telefono: hasIncomingValue(normalized.telefono) ? normalized.telefono : (existing.telefono || null),
            direccion: hasIncomingValue(normalized.direccion) ? normalized.direccion : (existing.direccion || null),
            codigo_barra: hasIncomingValue(normalized.codigoBarra) ? normalized.codigoBarra : (existing.codigo_barra || null),
            activo: incomingActivo,
            fecha_actualizacion: normalized.fechaActualizacion !== null
              ? normalized.fechaActualizacion
              : (existing.fecha_actualizacion ? new Date(existing.fecha_actualizacion).toISOString() : null)
          };

          const hasStudentChanges =
            (existing.matricula || '') !== (nextStudentPayload.matricula || '') ||
            existing.nombres !== nextStudentPayload.nombres ||
            existing.paterno !== nextStudentPayload.paterno ||
            (existing.materno || '') !== (nextStudentPayload.materno || '') ||
            (existing.email || '') !== (nextStudentPayload.email || '') ||
            (existing.telefono || '') !== (nextStudentPayload.telefono || '') ||
            (existing.direccion || '') !== (nextStudentPayload.direccion || '') ||
            (existing.sexo || '') !== (nextStudentPayload.sexo || '') ||
            (existing.fecha_nacimiento ? existing.fecha_nacimiento.toISOString().slice(0, 10) : null) !== nextStudentPayload.fecha_nacimiento ||
            (normalized.fechaActualizacion !== null && (existing.fecha_actualizacion ? new Date(existing.fecha_actualizacion).toISOString() : null) !== normalized.fechaActualizacion) ||
            (existing.dv || '') !== (nextStudentPayload.dv || '') ||
            (existing.codigo_barra || '') !== (nextStudentPayload.codigo_barra || '') ||
            existing.activo !== incomingActivo;

          const nextFechaActualizacion = nextStudentPayload.fecha_actualizacion;

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
                    codigo_barra = $11,
                    activo = $12,
                    fecha_actualizacion = $13
                WHERE id_alumno = $14
              `,
              [
                nextStudentPayload.matricula,
                nextStudentPayload.dv,
                nextStudentPayload.nombres,
                nextStudentPayload.paterno,
                nextStudentPayload.materno,
                nextStudentPayload.fecha_nacimiento,
                nextStudentPayload.sexo,
                nextStudentPayload.email,
                nextStudentPayload.telefono,
                nextStudentPayload.direccion,
                nextStudentPayload.codigo_barra,
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

        const changedComplemento = await upsertSimpleByAlumno(client, 'alumno_complemento', 'id_alumno', idAlumno, {
          lista: toNullable(normalized.complemento.lista),
          estado: toNullable(normalized.complemento.estado),
          foto: toNullable(normalized.complemento.foto),
          condicionalidad: toNullable(normalized.complemento.condicionalidad),
          nacionalidad: toNullable(normalized.complemento.nacionalidad),
          religion: toNullable(normalized.complemento.religion),
          opta_religion: normalized.complemento.opta_religion,
          cursos_repetidos: toNullable(normalized.complemento.cursos_repetidos),
          colegio_procedencia: toNullable(normalized.complemento.colegio_procedencia),
          retira_titular: toNullable(normalized.complemento.retira_titular),
          retira_suplente: toNullable(normalized.complemento.retira_suplente),
          centro_costo: toNullable(normalized.complemento.centro_costo),
          diagnostico_pie: normalized.complemento.diagnostico_pie,
          diagnostico_pie_escuela_lenguaje: normalized.complemento.diagnostico_pie_escuela_lenguaje,
          pie_tipo_discapacidad: normalized.complemento.pie_tipo_discapacidad,
          tx_etnia_indigena: toNullable(normalized.complemento.tx_etnia_indigena)
        });
        if (changedComplemento) rowChanged = true;

        const changedSaludDetalle = await upsertSimpleByAlumno(client, 'salud_detalle', 'id_alumno', idAlumno, {
          peso: toNullable(normalized.saludDetalle.peso),
          talla: toNullable(normalized.saludDetalle.talla),
          grupo_sangre: toNullable(normalized.saludDetalle.grupo_sangre),
          problemas_visuales: normalized.saludDetalle.problemas_visuales,
          problemas_auditivos: normalized.saludDetalle.problemas_auditivos,
          problemas_cardiacos: normalized.saludDetalle.problemas_cardiacos,
          problemas_columna: normalized.saludDetalle.problemas_columna
        });
        if (changedSaludDetalle) rowChanged = true;

        const changedEmergenciaDetalle = await upsertSimpleByAlumno(client, 'emergencia_detalle', 'id_alumno', idAlumno, {
          seguro: toNullable(normalized.emergenciaDetalle.seguro),
          isapre: toNullable(normalized.emergenciaDetalle.isapre),
          tx_obs_emergencia: toNullable(normalized.emergenciaDetalle.tx_obs_emergencia)
        });
        if (changedEmergenciaDetalle) rowChanged = true;

        const changedPagoDetalle = await upsertSimpleByAlumno(client, 'pago_detalle', 'id_alumno', idAlumno, {
          co_banco: toNullable(normalized.pagoDetalle.co_banco),
          nu_tarjeta_bancaria: toNullable(normalized.pagoDetalle.nu_tarjeta_bancaria),
          fe_vencimiento_tarjeta: normalized.pagoDetalle.fe_vencimiento_tarjeta
        });
        if (changedPagoDetalle) rowChanged = true;

        if (normalized.beneficiarioActivo !== null) {
          const changedBenef = await upsertSimpleByAlumno(client, 'beneficiario_alimentacion', 'id_beneficiario', idAlumno, {
            activo: normalized.beneficiarioActivo,
            fecha_inicio: normalized.beneficiarioFechaInicio || null,
            fecha_fin: normalized.beneficiarioFechaFin || null,
            motivo_ingreso: normalized.beneficiarioMotivo || null
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

        if (normalized.restriccionDietaria.length > 0) {
          for (const rawRestriction of normalized.restriccionDietaria) {
            const existingRestriction = await client.query(
              `
                SELECT id_restriccion
                FROM restriccion_dietaria
                WHERE id_alumno = $1 AND vigente = true AND LOWER(descripcion) = LOWER($2)
                LIMIT 1
              `,
              [idAlumno, rawRestriction]
            );
            if (existingRestriction.rows.length === 0) {
              await client.query(
                'INSERT INTO restriccion_dietaria (id_alumno, descripcion, vigente) VALUES ($1, $2, true)',
                [idAlumno, rawRestriction]
              );
              rowChanged = true;
            }
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

          if (contact.personaId) {
            const contactDetailChanged = await upsertSimpleByOwner(client, 'persona_contacto_detalle', 'id_persona', contact.personaId, {
              fecha_nacimiento: contact.detail?.fecha_nacimiento || null,
              comuna: toNullable(contact.detail?.comuna),
              empresa: toNullable(contact.detail?.empresa),
              telefono_empresa: toNullable(contact.detail?.telefono_empresa),
              estudios: toNullable(contact.detail?.estudios),
              profesion: toNullable(contact.detail?.profesion),
              nacionalidad: toNullable(contact.detail?.nacionalidad)
            });

            if (relationChanged || contactDetailChanged) rowChanged = true;
          } else if (relationChanged) {
            rowChanged = true;
          }
        }

        await client.query(
          `
            INSERT INTO alumno_excel_snapshot (id_alumno, raw_payload, fecha_importacion)
            VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
            ON CONFLICT (id_alumno)
            DO UPDATE SET raw_payload = EXCLUDED.raw_payload, fecha_importacion = EXCLUDED.fecha_importacion
          `,
          [idAlumno, JSON.stringify(rows[index])]
        );

        if (!existing) {
          summary.inserted++;
        } else if (rowChanged) {
          summary.updated++;
        } else {
          summary.unchanged++;
        }

        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
      } catch (rowError) {
        await client.query(`ROLLBACK TO SAVEPOINT ${rowSavepoint}`);
        await client.query(`RELEASE SAVEPOINT ${rowSavepoint}`);
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
    const snapshotRes = await pool.query('SELECT raw_payload, fecha_importacion FROM alumno_excel_snapshot WHERE id_alumno = $1', [id]);
    const complementoRes = await pool.query('SELECT * FROM alumno_complemento WHERE id_alumno = $1', [id]);
    const saludDetalleRes = await pool.query('SELECT * FROM salud_detalle WHERE id_alumno = $1', [id]);
    const emergenciaDetalleRes = await pool.query('SELECT * FROM emergencia_detalle WHERE id_alumno = $1', [id]);
    const pagoDetalleRes = await pool.query('SELECT * FROM pago_detalle WHERE id_alumno = $1', [id]);

    const contactosConDetalle = await Promise.all(contactoRes.rows.map(async (contacto) => {
      const detalleRes = await pool.query('SELECT * FROM persona_contacto_detalle WHERE id_persona = $1', [contacto.id_persona]);
      return {
        ...contacto,
        detalle: detalleRes.rows[0] || null
      };
    }));

    res.json({
      alumno: alumnoRes.rows[0],
      contactos: contactoRes.rows,
      contactosConDetalle,
      salud: saludRes.rows[0] || null,
      saludDetalle: saludDetalleRes.rows[0] || null,
      emergencia: emergenciaRes.rows[0] || null,
      emergenciaDetalle: emergenciaDetalleRes.rows[0] || null,
      finanzas: pagoRes.rows[0] || null,
      pagoDetalle: pagoDetalleRes.rows[0] || null,
      apoyo: apoyoRes.rows[0] || null,
      beneficios: benefRes.rows[0] || null,
      restricciones: restRes.rows.map(r => r.descripcion),
      complemento: complementoRes.rows[0] || null,
      rawExcel: snapshotRes.rows[0]?.raw_payload || null,
      rawExcelImportedAt: snapshotRes.rows[0]?.fecha_importacion || null
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Error interno en JOINs');
  }
});

bootstrapBaseSchema()
  .then(() => ensureExcelDerivedTables())
  .then(() => ensureExcelSnapshotTable())
  .then(() => ensureDefaultUsers())
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('No fue posible inicializar el esquema de la base:', err.message);
    process.exit(1);
  });
