const pool = require('./db');

async function run() {
  try {
    console.log("Buscando en alumnos...");
    const resAlumnos = await pool.query("SELECT * FROM alumno WHERE nombres ILIKE '%fabian%' OR paterno ILIKE '%fabian%' OR materno ILIKE '%fabian%'");
    console.log("Alumnos encontrados:", resAlumnos.rows);

    console.log("Buscando en usuarios...");
    const resUsuarios = await pool.query("SELECT * FROM usuarios WHERE correo ILIKE '%fabian%'");
    console.log("Usuarios encontrados:", resUsuarios.rows);

    console.log("Buscando en persona_contacto...");
    const resPersonas = await pool.query("SELECT * FROM persona_contacto WHERE nombres ILIKE '%fabian%' OR paterno ILIKE '%fabian%' OR materno ILIKE '%fabian%'");
    console.log("Persona Contacto encontrados:", resPersonas.rows);

  } catch(e) {
    console.error("Error ejecutando consulta:", e);
  } finally {
    pool.end();
  }
}

run();
