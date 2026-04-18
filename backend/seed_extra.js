// Agrega 15 alumnos extra para pruebas — NO toca los existentes
const pool = require('./db');

async function seedExtra() {
  try {
    // Obtener cursos existentes
    const cursos = await pool.query('SELECT id_curso FROM curso ORDER BY id_curso LIMIT 2');
    if (cursos.rows.length < 2) {
      console.error('Primero ejecuta seed.js para crear los cursos.');
      process.exit(1);
    }
    const curso1 = cursos.rows[0].id_curso;
    const curso2 = cursos.rows[1].id_curso;

    const now = new Date();
    const lastMonth = new Date(now); lastMonth.setMonth(now.getMonth() - 1);
    const nextMonth = new Date(now); nextMonth.setMonth(now.getMonth() + 1);
    const lastWeek = new Date(now); lastWeek.setDate(now.getDate() - 7);
    const fmt = (d) => d.toISOString().split('T')[0];

    const alumnos = [
      // --- BENEFICIARIOS ACTIVOS (buscar por nombre → registra OK) ---
      { nombres: 'Martín', paterno: 'González', materno: 'Pérez', rut: '26000001', dv: '6', matricula: '2025-010', codigo_barra: 'B-1010', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [] },
      { nombres: 'Isidora', paterno: 'Martínez', materno: 'Campos', rut: '26000002', dv: '7', matricula: '2025-011', codigo_barra: 'B-1011', curso: curso2, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [] },
      { nombres: 'Agustín', paterno: 'López', materno: 'Ramírez', rut: '26000003', dv: '8', matricula: '2025-012', codigo_barra: 'B-1012', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'Tramo Preferente' }, restricciones: [] },
      { nombres: 'Florencia', paterno: 'Vargas', materno: 'Tapia', rut: '26000004', dv: '9', matricula: '2025-013', codigo_barra: 'B-1013', curso: curso2, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'Vulnerabilidad' }, restricciones: [] },
      { nombres: 'Tomás', paterno: 'Soto', materno: 'Bravo', rut: '26000005', dv: '0', matricula: '2025-014', codigo_barra: 'B-1014', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [] },

      // --- CON RESTRICCIONES DIETARIAS ---
      { nombres: 'Catalina', paterno: 'Reyes', materno: 'Fuentes', rut: '26000006', dv: '1', matricula: '2025-015', codigo_barra: 'B-1015', curso: curso2, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: ['Celíaca', 'Intolerante a la lactosa'] },
      { nombres: 'Benjamín', paterno: 'Araya', materno: 'Morales', rut: '26000007', dv: '2', matricula: '2025-016', codigo_barra: 'B-1016', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'Tramo Preferente' }, restricciones: ['Alérgico al maní'] },

      // --- NO BENEFICIARIOS (registro sale con badge naranja) ---
      { nombres: 'Antonia', paterno: 'Díaz', materno: 'Contreras', rut: '26000008', dv: '3', matricula: '2025-017', codigo_barra: 'B-1017', curso: curso2, beneficio: null, restricciones: [] },
      { nombres: 'Maximiliano', paterno: 'Rivera', materno: 'Jara', rut: '26000009', dv: '4', matricula: '2025-018', codigo_barra: 'B-1018', curso: curso1, beneficio: null, restricciones: [] },

      // --- BENEFICIO VENCIDO (para probar validación de fechas) ---
      { nombres: 'Emilia', paterno: 'Castro', materno: 'Núñez', rut: '26000010', dv: '5', matricula: '2025-019', codigo_barra: 'B-1019', curso: curso2, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(lastWeek), motivo: 'Apoyo Temporal Vencido' }, restricciones: [] },

      // --- ALUMNO INACTIVO (no debería aparecer en búsqueda) ---
      { nombres: 'Joaquín', paterno: 'Herrera', materno: 'Pizarro', rut: '26000011', dv: '6', matricula: '2025-020', codigo_barra: 'B-1020', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [], activo: false },

      // --- NOMBRES SIMILARES (para probar dropdown con múltiples resultados) ---
      { nombres: 'Martina', paterno: 'González', materno: 'Silva', rut: '26000012', dv: '7', matricula: '2025-021', codigo_barra: 'B-1021', curso: curso2, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [] },
      { nombres: 'Martín', paterno: 'García', materno: 'Muñoz', rut: '26000013', dv: '8', matricula: '2025-022', codigo_barra: 'B-1022', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [] },
      { nombres: 'María', paterno: 'Martínez', materno: 'Rojas', rut: '26000014', dv: '9', matricula: '2025-023', codigo_barra: 'B-1023', curso: curso2, beneficio: null, restricciones: ['Vegetariana'] },
      { nombres: 'Diego', paterno: 'González', materno: 'Torres', rut: '26000015', dv: '0', matricula: '2025-024', codigo_barra: 'B-1024', curso: curso1, beneficio: { activo: true, ini: fmt(lastMonth), fin: fmt(nextMonth), motivo: 'JUNAEB' }, restricciones: [] },
    ];

    let inserted = 0;
    for (const a of alumnos) {
      const activo = a.activo !== undefined ? a.activo : true;

      // Alumno
      const res = await pool.query(
        `INSERT INTO alumno (matricula, rut, dv, nombres, paterno, materno, fecha_nacimiento, sexo, email, telefono, direccion, codigo_barra, activo)
         VALUES ($1,$2,$3,$4,$5,$6,'2007-06-15','Masculino',NULL,NULL,NULL,$7,$8)
         ON CONFLICT (rut) DO NOTHING RETURNING id_alumno`,
        [a.matricula, a.rut, a.dv, a.nombres, a.paterno, a.materno, a.codigo_barra, activo]
      );
      if (res.rows.length === 0) { console.log(`  ⏭ ${a.nombres} ${a.paterno} ya existe, saltando.`); continue; }
      const id = res.rows[0].id_alumno;

      // Matrícula
      await pool.query('INSERT INTO matricula (id_alumno, id_curso, fecha_matricula, alumno_nuevo) VALUES ($1,$2,CURRENT_DATE,true)', [id, a.curso]);

      // Beneficio
      if (a.beneficio) {
        await pool.query(
          'INSERT INTO beneficiario_alimentacion (id_alumno, activo, fecha_inicio, fecha_fin, motivo_ingreso) VALUES ($1,$2,$3,$4,$5)',
          [id, a.beneficio.activo, a.beneficio.ini, a.beneficio.fin, a.beneficio.motivo]
        );
      }

      // Restricciones
      for (const r of a.restricciones) {
        await pool.query('INSERT INTO restriccion_dietaria (id_alumno, descripcion) VALUES ($1,$2)', [id, r]);
      }

      inserted++;
      console.log(`  ✓ ${a.nombres} ${a.paterno} ${a.materno} (${a.rut}-${a.dv}) — ${a.beneficio ? 'Beneficiario' : 'No beneficiario'}${a.restricciones.length ? ' — Restricciones: ' + a.restricciones.join(', ') : ''}${!activo ? ' — INACTIVO' : ''}`);
    }

    console.log(`\n¡Listo! ${inserted} alumnos extra insertados.`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}

seedExtra();
