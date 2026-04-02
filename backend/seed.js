const pool = require('./db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function setupAndSeed() {
  try {
    const initSqlPath = path.join(__dirname, 'init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf8');

    console.log('Creando tablas desde init.sql...');
    await pool.query(initSql);
    console.log('Tablas creadas exitosamente.');

    // 1. USUARIOS ADMIN Y LECTOR
    console.log('Insertando Usuarios (Auth)...');
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

    // 2. NIVELES Y CURSOS
    console.log('Insertando Niveles y Cursos...');
    const nivelMedia = await pool.query("INSERT INTO nivel_ensenanza (nombre) VALUES ('Educación Media') RETURNING id_nivel");
    const nivelBasica = await pool.query("INSERT INTO nivel_ensenanza (nombre) VALUES ('Educación Básica') RETURNING id_nivel");
    
    const idNavMedia = nivelMedia.rows[0].id_nivel;
    const idNavBasica = nivelBasica.rows[0].id_nivel;

    const curso1Res = await pool.query("INSERT INTO curso (nombre_curso, id_nivel) VALUES ('3ro Medio A', $1) RETURNING id_curso", [idNavMedia]);
    const curso2Res = await pool.query("INSERT INTO curso (nombre_curso, id_nivel) VALUES ('8vo Básico B', $1) RETURNING id_curso", [idNavBasica]);
    
    // 3. GENERAR 5 PERFILES COMPLETOS FICTICIOS
    console.log('Insertando 5 Alumnos (Perfiles Completos)......');
    const now = new Date();
    const lastMonth = new Date(now); lastMonth.setMonth(now.getMonth() - 1);
    const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 7);
    const nextMonth = new Date(now); nextMonth.setMonth(now.getMonth() + 1);
    const formatToDate = (d) => d.toISOString().split('T')[0];

    const perfilesFicticios = [
      {
        alumno: { nombres: 'Sebastián', paterno: 'Rojas', materno: 'Soto', rut: '21111111', dv: '1', matricula: '2023-001', fecha_nacimiento: '2005-04-12', sexo: 'Masculino', email: 'srojas@colegio.cl', telefono: '+56988887777', direccion: 'Avenida Siempre Viva 123', codigo_barra: 'B-100', activo: true },
        curso_asignado: curso1Res.rows[0].id_curso,
        contacto: { rut: '15111111', dv: 'k', nombres: 'Ana', paterno: 'Soto', materno: 'Perez', telefono: '+56912345678', email: 'anasoto@gmail.com', direccion: 'Avenida Siempre Viva 123' },
        relacion: { tipo_relacion: 'Madre', autoriza_foto: true, es_contacto_principal: true, vive_con_alumno: true },
        pago: { forma_pago: 'Transferencia', banco: 'BancoEstado', tipo_cuenta: 'RUT', numero_cuenta: '15111111' },
        apoyo: { vulnerable: false, prioritario: false, preferente: true },
        salud: { asma: true, diabetes: false, epilepsia: false, observaciones: 'Usar inhalador Salbutamol en educación física' },
        emergencia: { avisar_a: 'Ana Soto', telefono_emergencia: '+56912345678', trasladar_a: 'Posta Central' },
        beneficiario: { activo: true, f_ini: formatToDate(lastMonth), f_fin: formatToDate(nextMonth), motivo: 'Tramo Preferente A', resolucion: 'RES-001' },
        restricciones: []
      },
      {
        alumno: { nombres: 'Valentina', paterno: 'Muñoz', materno: 'Silva', rut: '22222222', dv: '2', matricula: '2024-002', fecha_nacimiento: '2008-09-05', sexo: 'Femenino', email: 'vmunoz@colegio.cl', telefono: '+56977776666', direccion: 'Pasaje Los Robles 45', codigo_barra: 'B-200', activo: true },
        curso_asignado: curso2Res.rows[0].id_curso,
        contacto: { rut: '16222222', dv: '4', nombres: 'Carlos', paterno: 'Muñoz', materno: 'Tapia', telefono: '+56987654321', email: 'cmunoz@empresa.com', direccion: 'Pasaje Los Robles 45' },
        relacion: { tipo_relacion: 'Padre', autoriza_foto: false, es_contacto_principal: true, vive_con_alumno: true },
        pago: { forma_pago: 'Cheque', banco: 'Banco Santander', tipo_cuenta: 'Corriente', numero_cuenta: '00987343' },
        apoyo: { vulnerable: false, prioritario: false, preferente: false },
        salud: { asma: false, diabetes: false, epilepsia: false, observaciones: null },
        emergencia: { avisar_a: 'Carlos Muñoz', telefono_emergencia: '+56987654321', trasladar_a: 'Clinica Las Condes' },
        beneficiario: { activo: false, f_ini: null, f_fin: null, motivo: null, resolucion: null },
        restricciones: ['Alérgica al maní', 'Celíaca']
      },
      {
        alumno: { nombres: 'Lucas', paterno: 'Fernández', materno: 'Vera', rut: '23333333', dv: '3', matricula: '2022-003', fecha_nacimiento: '2006-11-20', sexo: 'Masculino', email: 'lfernandez@colegio.cl', telefono: '+56966665555', direccion: 'Condominio El Sol, Torre B, Depto 402', codigo_barra: 'B-300', activo: true },
        curso_asignado: curso1Res.rows[0].id_curso,
        contacto: { rut: '12333333', dv: '1', nombres: 'Marta', paterno: 'Vera', materno: 'Guzmán', telefono: '+56955554444', email: 'marta.vera@yahoo.com', direccion: 'Condominio El Sol, Torre B, Depto 402' },
        relacion: { tipo_relacion: 'Abuela', autoriza_foto: true, es_contacto_principal: true, vive_con_alumno: true },
        pago: { forma_pago: 'Efectivo', banco: null, tipo_cuenta: null, numero_cuenta: null },
        apoyo: { vulnerable: true, prioritario: true, preferente: false },
        salud: { asma: false, diabetes: true, epilepsia: false, observaciones: 'Insulino dependiente. Requiere medición después de almuerzo.' },
        emergencia: { avisar_a: 'Tia Rosa', telefono_emergencia: '+56944443333', trasladar_a: 'Hospital San José' },
        beneficiario: { activo: true, f_ini: formatToDate(lastMonth), f_fin: formatToDate(nextMonth), motivo: 'Vulnerabilidad Extrema', resolucion: 'RES-045' },
        restricciones: ['Diabético (Sin azúcar)']
      },
      {
        // Alumno FUGADO (Inactivo)
        alumno: { nombres: 'Matias', paterno: 'Herrera', materno: 'Díaz', rut: '24444444', dv: '4', matricula: '2021-004', fecha_nacimiento: '2005-01-30', sexo: 'Masculino', email: 'mati.hd@gmail.com', telefono: '+56933332222', direccion: 'Calle Falsa 123', codigo_barra: 'B-400', activo: false },
        curso_asignado: curso1Res.rows[0].id_curso,
        contacto: { rut: '10444444', dv: '8', nombres: 'Jose', paterno: 'Herrera', materno: 'Castro', telefono: '+56922221111', email: 'joseh@outlook.com', direccion: 'Calle Falsa 123' },
        relacion: { tipo_relacion: 'Padre', autoriza_foto: false, es_contacto_principal: true, vive_con_alumno: false },
        pago: { forma_pago: 'Transferencia', banco: 'Banco de Chile', tipo_cuenta: 'Ahorro', numero_cuenta: '888888' },
        apoyo: { vulnerable: false, prioritario: false, preferente: true },
        salud: { asma: false, diabetes: false, epilepsia: false, observaciones: null },
        emergencia: { avisar_a: 'Jose Herrera', telefono_emergencia: '+56922221111', trasladar_a: 'Clinica Alemana' },
        beneficiario: { activo: true, f_ini: formatToDate(lastMonth), f_fin: formatToDate(nextMonth), motivo: 'Beneficio antiguo', resolucion: 'RES-099' },
        restricciones: []
      },
      {
        // Alumno con Beneficio Vencido
        alumno: { nombres: 'Camila', paterno: 'Espinoza', materno: 'Lagos', rut: '25555555', dv: '5', matricula: '2023-005', fecha_nacimiento: '2008-03-15', sexo: 'Femenino', email: 'cespinoza@colegio.cl', telefono: '+56911110000', direccion: 'Villa Las Estrellas 98', codigo_barra: 'B-500', activo: true },
        curso_asignado: curso2Res.rows[0].id_curso,
        contacto: { rut: '17555555', dv: '0', nombres: 'Laura', paterno: 'Lagos', materno: 'Mora', telefono: '+56900009999', email: 'llagos@gmail.com', direccion: 'Villa Las Estrellas 98' },
        relacion: { tipo_relacion: 'Madre', autoriza_foto: true, es_contacto_principal: true, vive_con_alumno: true },
        pago: { forma_pago: 'Transferencia', banco: 'Banco Falabella', tipo_cuenta: 'Corriente', numero_cuenta: '55555555' },
        apoyo: { vulnerable: false, prioritario: false, preferente: false },
        salud: { asma: false, diabetes: false, epilepsia: true, observaciones: 'Medicada con anticonvulsivantes' },
        emergencia: { avisar_a: 'Laura Lagos', telefono_emergencia: '+56900009999', trasladar_a: 'Sapu Oriente' },
        beneficiario: { activo: true, f_ini: formatToDate(lastMonth), f_fin: formatToDate(lastWeek), motivo: 'Apoyo Temporal', resolucion: 'RES-103' },
        restricciones: []
      }
    ];

    for (const data of perfilesFicticios) {
      // 1. Insertar Alumno
      const aluRes = await pool.query(
        'INSERT INTO alumno (matricula, rut, dv, nombres, paterno, materno, fecha_nacimiento, sexo, email, telefono, direccion, codigo_barra, activo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id_alumno',
        [data.alumno.matricula, data.alumno.rut, data.alumno.dv, data.alumno.nombres, data.alumno.paterno, data.alumno.materno, data.alumno.fecha_nacimiento, data.alumno.sexo, data.alumno.email, data.alumno.telefono, data.alumno.direccion, data.alumno.codigo_barra, data.alumno.activo]
      );
      const idAlumno = aluRes.rows[0].id_alumno;

      // 2. Insertar Matricula (Asocia al Curso)
      await pool.query(
        'INSERT INTO matricula (id_alumno, id_curso, fecha_matricula, alumno_nuevo) VALUES ($1, $2, CURRENT_DATE, true)',
        [idAlumno, data.curso_asignado]
      );

      // 3. Insertar Contacto y Relacion
      const contRes = await pool.query(
        'INSERT INTO persona_contacto (rut, dv, nombres, paterno, materno, telefono, email, direccion) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (rut) DO UPDATE SET nombres = EXCLUDED.nombres RETURNING id_persona',
        [data.contacto.rut, data.contacto.dv, data.contacto.nombres, data.contacto.paterno, data.contacto.materno, data.contacto.telefono, data.contacto.email, data.contacto.direccion]
      );
      const idContacto = contRes.rows[0].id_persona;

      await pool.query(
        'INSERT INTO relacion_alumno_persona (id_alumno, id_persona, tipo_relacion, autoriza_foto, es_contacto_principal, vive_con_alumno) VALUES ($1, $2, $3, $4, $5, $6)',
        [idAlumno, idContacto, data.relacion.tipo_relacion, data.relacion.autoriza_foto, data.relacion.es_contacto_principal, data.relacion.vive_con_alumno]
      );

      // 4. Tablas Extra (Salud, Emergencia, Programa Apoyo, Pago)
      await pool.query(
        'INSERT INTO pago (id_alumno, forma_pago, banco, tipo_cuenta, numero_cuenta) VALUES ($1, $2, $3, $4, $5)',
        [idAlumno, data.pago.forma_pago, data.pago.banco, data.pago.tipo_cuenta, data.pago.numero_cuenta]
      );

      await pool.query(
        'INSERT INTO programa_apoyo (id_alumno, vulnerable, prioritario, preferente) VALUES ($1, $2, $3, $4)',
        [idAlumno, data.apoyo.vulnerable, data.apoyo.prioritario, data.apoyo.preferente]
      );

      await pool.query(
        'INSERT INTO salud (id_alumno, asma, diabetes, epilepsia, observaciones) VALUES ($1, $2, $3, $4, $5)',
        [idAlumno, data.salud.asma, data.salud.diabetes, data.salud.epilepsia, data.salud.observaciones]
      );

      await pool.query(
        'INSERT INTO emergencia (id_alumno, avisar_a, telefono_emergencia, trasladar_a) VALUES ($1, $2, $3, $4)',
        [idAlumno, data.emergencia.avisar_a, data.emergencia.telefono_emergencia, data.emergencia.trasladar_a]
      );

      // 5. Beneficio de Alimentación
      if (data.beneficiario.activo || data.beneficiario.f_ini) {
        await pool.query(
          'INSERT INTO beneficiario_alimentacion (id_alumno, activo, fecha_inicio, fecha_fin, motivo_ingreso, resolucion_asistente_social) VALUES ($1, $2, $3, $4, $5, $6)',
          [idAlumno, data.beneficiario.activo, data.beneficiario.f_ini, data.beneficiario.f_fin, data.beneficiario.motivo, data.beneficiario.resolucion]
        );
      }

      // 6. Restricciones Dietarias
      for (const restriccion of data.restricciones) {
        await pool.query(
          'INSERT INTO restriccion_dietaria (id_alumno, descripcion) VALUES ($1, $2)',
          [idAlumno, restriccion]
        );
      }
    }

    console.log('Base de datos inicializada: ¡5 registros ficticios 100% integrales inyectados!');

  } catch (err) {
    console.error('Error configurando la BD:', err.message);
  } finally {
    pool.end();
  }
}

setupAndSeed();
