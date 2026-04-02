-- Modulo Sistema Mayor (DER)
DROP TABLE IF EXISTS lunch_registrations CASCADE;
DROP TABLE IF EXISTS estudiantes CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS relacion_alumno_persona CASCADE;
DROP TABLE IF EXISTS persona_contacto CASCADE;
DROP TABLE IF EXISTS emergencia CASCADE;
DROP TABLE IF EXISTS salud CASCADE;
DROP TABLE IF EXISTS programa_apoyo CASCADE;
DROP TABLE IF EXISTS pago CASCADE;
DROP TABLE IF EXISTS matricula CASCADE;
DROP TABLE IF EXISTS restriccion_dietaria CASCADE;
DROP TABLE IF EXISTS beneficiario_alimentacion CASCADE;
DROP TABLE IF EXISTS alumno CASCADE;
DROP TABLE IF EXISTS curso CASCADE;
DROP TABLE IF EXISTS nivel_ensenanza CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

CREATE TABLE nivel_ensenanza (
  id_nivel SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE curso (
  id_curso SERIAL PRIMARY KEY,
  nombre_curso VARCHAR(100) NOT NULL,
  id_nivel INT REFERENCES nivel_ensenanza(id_nivel) ON DELETE CASCADE
);

CREATE TABLE alumno (
  id_alumno SERIAL PRIMARY KEY,
  matricula VARCHAR(50),
  rut VARCHAR(12) UNIQUE,
  dv CHAR(1),
  nombres VARCHAR(100) NOT NULL,
  paterno VARCHAR(100) NOT NULL,
  materno VARCHAR(100),
  fecha_nacimiento DATE,
  sexo VARCHAR(20),
  email VARCHAR(150),
  telefono VARCHAR(20),
  direccion VARCHAR(255),
  codigo_barra VARCHAR(100) UNIQUE, -- NUEVO: Campo único para lector de tarjetas
  activo BOOLEAN DEFAULT true     -- NUEVO: Borrado lógico, en lugar de borrar la fila
);

CREATE TABLE persona_contacto (
  id_persona SERIAL PRIMARY KEY,
  rut VARCHAR(12) UNIQUE,
  dv CHAR(1),
  nombres VARCHAR(100) NOT NULL,
  paterno VARCHAR(100) NOT NULL,
  materno VARCHAR(100),
  telefono VARCHAR(20),
  email VARCHAR(150),
  direccion VARCHAR(255)
);

CREATE TABLE relacion_alumno_persona (
  id_relacion SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  id_persona INT REFERENCES persona_contacto(id_persona) ON DELETE CASCADE,
  tipo_relacion VARCHAR(50),
  autoriza_foto BOOLEAN DEFAULT false,
  es_contacto_principal BOOLEAN DEFAULT false,
  vive_con_alumno BOOLEAN DEFAULT false
);

CREATE TABLE matricula (
  id_matricula SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  id_curso INT REFERENCES curso(id_curso) ON DELETE CASCADE,
  fecha_matricula DATE,
  fecha_inscripcion DATE,
  fecha_retiro DATE,
  alumno_nuevo BOOLEAN DEFAULT true,
  repetidor BOOLEAN DEFAULT false
);

CREATE TABLE pago (
  id_pago SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  forma_pago VARCHAR(50),
  banco VARCHAR(100),
  tipo_cuenta VARCHAR(50),
  numero_cuenta VARCHAR(50)
);

CREATE TABLE programa_apoyo (
  id_programa SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  vulnerable BOOLEAN DEFAULT false,
  prioritario BOOLEAN DEFAULT false,
  preferente BOOLEAN DEFAULT false
);

CREATE TABLE salud (
  id_salud SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  asma BOOLEAN DEFAULT false,
  diabetes BOOLEAN DEFAULT false,
  epilepsia BOOLEAN DEFAULT false,
  observaciones TEXT
);

CREATE TABLE emergencia (
  id_emergencia SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  avisar_a VARCHAR(100),
  telefono_emergencia VARCHAR(20),
  trasladar_a VARCHAR(150)
);

-- Modulo Alimentación y Autenticación
CREATE TABLE usuarios (
  id SERIAL PRIMARY KEY,
  correo VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL -- 'admin' o 'lector'
);

CREATE TABLE beneficiario_alimentacion (
  id_beneficiario SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  activo BOOLEAN DEFAULT true,
  fecha_inicio DATE,
  fecha_fin DATE,
  motivo_ingreso TEXT,
  resolucion_asistente_social TEXT
);

CREATE TABLE restriccion_dietaria (
  id_restriccion SERIAL PRIMARY KEY,
  id_alumno INT REFERENCES alumno(id_alumno) ON DELETE CASCADE,
  descripcion VARCHAR(255) NOT NULL,
  vigente BOOLEAN DEFAULT true,
  fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE lunch_registrations (
  id_registro SERIAL PRIMARY KEY,
  -- MODIFICADO: Eliminado el ON DELETE CASCADE del id_alumno. Esto asegura 
  -- que no se pierdan históricos de consumos si alguien hace force delete
  id_alumno INT REFERENCES alumno(id_alumno),
  fecha_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_entrega TIME NOT NULL DEFAULT CURRENT_TIME,
  tipo_alimentacion VARCHAR(50) NOT NULL,
  es_beneficiario_al_momento BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
