-- ─────────────────────────────────────────────────────────────────────────────
-- init.sql  –  Creación segura del esquema base (sin DROP TABLE)
-- Usa CREATE TABLE IF NOT EXISTS para que sea idempotente.
-- Si las tablas ya existen, no se toca ningún dato.
-- ─────────────────────────────────────────────────────────────────────────────

-- Módulo Sistema Mayor (DER)

CREATE TABLE IF NOT EXISTS nivel_ensenanza (
  id_nivel SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS curso (
  id_curso SERIAL PRIMARY KEY,
  nombre_curso VARCHAR(100) NOT NULL,
  id_nivel INT REFERENCES nivel_ensenanza(id_nivel) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alumno (
  id_alumno SERIAL PRIMARY KEY,
  matricula VARCHAR(50),
  rut VARCHAR(12) UNIQUE,
  dv CHAR(1),
  nombres VARCHAR(100) NOT NULL,
  paterno VARCHAR(100) NOT NULL,
  materno VARCHAR(100),
  fecha_nacimiento DATE,
  sexo VARCHAR(50),
  email VARCHAR(150),
  telefono VARCHAR(50),
  direccion VARCHAR(255),
  fecha_actualizacion TIMESTAMP,
  codigo_barra VARCHAR(100) UNIQUE,
  tne_codigo_barra VARCHAR(100),
  activo BOOLEAN DEFAULT true
);

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
);

CREATE TABLE IF NOT EXISTS persona_contacto (
  id_persona SERIAL PRIMARY KEY,
  rut VARCHAR(12) UNIQUE,
  dv CHAR(1),
  nombres VARCHAR(100) NOT NULL,
  paterno VARCHAR(100) NOT NULL,
  materno VARCHAR(100),
  telefono VARCHAR(50),
  email VARCHAR(150),
  direccion VARCHAR(255)
);

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
);

CREATE TABLE IF NOT EXISTS relacion_alumno_persona (
  id_relacion SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  id_persona INT REFERENCES persona_contacto(id_persona) ON DELETE CASCADE,
  tipo_relacion VARCHAR(50),
  autoriza_foto BOOLEAN DEFAULT false,
  es_contacto_principal BOOLEAN DEFAULT false,
  vive_con_alumno BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS matricula (
  id_matricula SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  id_curso INT REFERENCES curso(id_curso) ON DELETE CASCADE,
  fecha_matricula DATE,
  fecha_inscripcion DATE,
  fecha_retiro DATE,
  alumno_nuevo BOOLEAN DEFAULT true,
  repetidor BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS pago (
  id_pago SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  forma_pago VARCHAR(50),
  banco VARCHAR(100),
  tipo_cuenta VARCHAR(50),
  numero_cuenta VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS pago_detalle (
  id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  co_banco VARCHAR(50),
  nu_tarjeta_bancaria VARCHAR(50),
  fe_vencimiento_tarjeta DATE,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS programa_apoyo (
  id_programa SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  vulnerable BOOLEAN DEFAULT false,
  prioritario BOOLEAN DEFAULT false,
  preferente BOOLEAN DEFAULT false,
  pro_retencion BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS salud (
  id_salud SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  asma BOOLEAN DEFAULT false,
  diabetes BOOLEAN DEFAULT false,
  epilepsia BOOLEAN DEFAULT false,
  observaciones TEXT,
  alergia_medicamentos VARCHAR(255)
);

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
);

CREATE TABLE IF NOT EXISTS emergencia (
  id_emergencia SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  avisar_a VARCHAR(100),
  telefono_emergencia VARCHAR(50),
  trasladar_a VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS emergencia_detalle (
  id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  seguro VARCHAR(100),
  isapre VARCHAR(100),
  tx_obs_emergencia TEXT,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Módulo Alimentación y Autenticación

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  correo VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  nombre VARCHAR(100),
  intentos_fallidos INT DEFAULT 0,
  bloqueado_hasta TIMESTAMP,
  token_version INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS beneficiario_alimentacion (
  id_beneficiario SERIAL PRIMARY KEY,
  id_alumno INT NOT NULL REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  activo BOOLEAN NOT NULL DEFAULT true,
  fecha_inicio DATE,
  fecha_fin DATE,
  motivo_ingreso VARCHAR(255),
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restriccion_dietaria (
  id_restriccion SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  descripcion VARCHAR(255) NOT NULL,
  vigente BOOLEAN DEFAULT true,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alumno_excel_snapshot (
  id_alumno INT PRIMARY KEY REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  raw_payload JSONB NOT NULL,
  fecha_importacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lunch_registrations (
  id_registro SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno),
  fecha_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrega TIME NOT NULL DEFAULT CURRENT_TIME,
  tipo_alimentacion VARCHAR(50) NOT NULL,
  es_beneficiario_al_momento BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
