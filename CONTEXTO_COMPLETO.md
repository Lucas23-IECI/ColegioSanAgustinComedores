# Contexto Completo — Sistema de Colaciones Colegio San Agustín

> **Última actualización:** 17/04/2026 — Revisión completa rama WIP (commit `41bc8df`)

## 1. ¿Qué es este proyecto?

Sistema web para registrar y controlar la entrega de colaciones (desayuno, almuerzo, once) a estudiantes del Colegio San Agustín. El registro se hace escaneando códigos de barra con un lector USB conectado al computador. Es un sistema de uso interno, desplegado en un servidor físico dentro del colegio.

---

## 2. Contexto real del colegio

- **~1000 alumnos**, de los cuales **208 son beneficiarios JUNAEB** (desayuno + almuerzo cubiertos por el gobierno)
- **Lectores disponibles:** 2 escáneres USB de código de barra (funcionan como teclado, envían texto + Enter)
- **SAP FullCollege:** sistema escolar existente que maneja notas, matrículas, biblioteca. Provee foto + ID + datos por alumno. La nómina se puede exportar por Excel
- **Hardware disponible:** 2 servidores físicos sin uso + 1 **HP Proliant ML110 G7** (este es el servidor principal elegido), 1 tótem táctil con huellero y lector tarjetas
- **Colaciones de funcionarios:** ya existe un programa separado alojado en la nube
- **Necesidades:** informes diarios de asistencia al comedor + registro de condiciones de salud alimentarias (alergias, restricciones)

---

## 3. Equipo

| Persona | Rol | Ubicación |
|---|---|---|
| **Lucas Méndez** | Desarrollador principal (frontend, diseño, lógica de negocio) | Hualqui |
| **Humberto Andrades** | Desarrollador (backend, infra, servidor, BD, migración Excel) | Talcahuano |
| **Ariel Andia** | Coordinador (profesor del colegio) | Colegio |
| **Carolina Salinas** | Coordinadora (asistente social) | Colegio |

---

## 4. Stack tecnológico

### Frontend
| Tecnología | Versión | Propósito |
|---|---|---|
| React | 19.2.4 | Interfaz de usuario |
| Vite | 8.0.1 | Bundler y servidor de desarrollo |
| React Router DOM | 7.13.1 | Enrutamiento SPA |
| Axios | 1.13.6 | Cliente HTTP |
| JsBarcode | 3.12.3 | Generación de códigos de barra |
| XLSX | 0.18.5 | Exportación e importación de datos Excel |
| Lucide React | 0.577.0 | Iconos |

### Backend
| Tecnología | Versión | Propósito |
|---|---|---|
| Express | 5.2.1 | Servidor HTTP y API REST |
| pg | 8.20.0 | Cliente PostgreSQL para Node |
| dotenv | 17.3.1 | Variables de entorno |
| cors | 2.8.6 | Manejo de CORS |
| bcryptjs | 3.0.3 | Hash de contraseñas |
| jsonwebtoken | 9.0.3 | Tokens JWT |
| cookie-parser | 1.4.7 | Lectura de cookies |

### Base de datos
| Tecnología | Versión | Propósito |
|---|---|---|
| PostgreSQL | 16 | Base de datos relacional |

### Despliegue
- **Servidor físico:** HP Proliant ML110 G7 ubicado en el colegio
- **Sistema operativo del servidor:** Ubuntu Server 22.04
- **VPN:** Tailscale (configurada y operativa desde 08-09/04/26)
- **No se usa nube** — todo es local en la red del colegio, acceso remoto vía Tailscale

---

## 5. Infraestructura y acceso remoto (VPN)

### El problema
El servidor HP Proliant está dentro de la red del colegio, detrás del NAT del ISP. Los desarrolladores (Lucas en Hualqui, Humberto en Talcahuano) necesitan SSH al servidor para desarrollar y mantener el sistema sin ir físicamente al colegio.

### Solución implementada: Tailscale
- **Funciona con cuentas de correo** — cada persona se loguea con su email y queda en la misma red privada virtual ("tailnet")
- Basado en **WireGuard** por debajo (protocolo VPN moderno, rápido, cifrado)
- **No necesita abrir puertos** en el router del colegio — usa NAT traversal automático
- **No necesita VPS intermedio** — las conexiones son peer-to-peer directas
- Cada dispositivo recibe una IP estable tipo `100.x.x.x`
- **Plan gratuito:** hasta 100 dispositivos, 3 usuarios (perfecto para este caso)
- Setup: instalar Tailscale en el Proliant + en los PCs de los devs, loguear, listo

### Historial de decisión
- Se evaluó **Wireguard** directo (04/04/26) — **Fallido**, demasiado complejo para el caso
- Se evaluó **Tailscale** (05/04/26) — Exitoso en server personal
- Se configuró **Tailscale** en servidor CSAC del colegio (08-09/04/26) — **Operativo**

---

## 6. Cómo levantar el proyecto

### Requisitos previos
1. PostgreSQL 16 corriendo localmente
2. Crear base de datos `MVP_Colaciones` (o el nombre que se ponga en .env)
3. Node.js instalado

### Variables de entorno (`backend/.env`)
```
DB_USER=tu_usuario
DB_HOST=localhost
DB_NAME=MVP_Colaciones
DB_PASSWORD=tu_password
DB_PORT=5432
PORT=5000
JWT_SECRET=tu_secreto_jwt
```

### Primera vez (inicializar BD + datos de prueba)
```bash
cd backend
npm install
node seed.js    # Crea TODAS las tablas (ejecuta init.sql) + inserta 5 alumnos ficticios completos + 2 usuarios (admin/lector)
```

### Levantar el sistema
```bash
# Terminal 1 — Backend (puerto 5000)
cd backend
node server.js
# Al arrancar: verifica si existen tablas, crea las que falten, asegura usuarios default

# Terminal 2 — Frontend (puerto 5173)
cd frontend
npm install
npm run dev
```

### Acceder
- `http://localhost:5173`
- **Login admin:** `admin@colegio.cl` / `1234`
- **Login lector:** `lector@colegio.cl` / `1234`

### Nota importante sobre el arranque
`server.js` hace auto-bootstrap al arrancar:
1. `bootstrapBaseSchema()` — Si no existe tabla `alumno`, ejecuta `init.sql` completo
2. `ensureExcelDerivedTables()` — Crea tablas _detalle si no existen (`alumno_complemento`, `persona_contacto_detalle`, `pago_detalle`, `salud_detalle`, `emergencia_detalle`)
3. `ensureExcelSnapshotTable()` — Crea tabla `alumno_excel_snapshot` si no existe
4. `ensureDefaultUsers()` — Inserta usuarios admin/lector si no existen (con `ON CONFLICT DO NOTHING`)

---

## 7. Estado del código — Rama `main` (MVP estable)

### Estructura
```
ColegioSanAgustinComedores/
  backend/
    .env               # Variables de entorno (no versionado)
    db.js              # Pool de conexión PostgreSQL
    init.sql           # Esquema DDL (2 tablas: students, lunch_registrations)
    seed.js            # Carga 7 estudiantes de prueba
    server.js          # Express con endpoints CRUD
    package.json
  frontend/
    src/
      App.jsx          # Página principal: registro de colaciones
      Students.jsx     # CRUD de estudiantes
      Nav.jsx          # Navegación con tabs
      TestBarcodes.jsx # Generación e impresión de barcodes
      main.jsx         # Punto de entrada con React Router
      index.css        # Estilos responsive
```

### Base de datos (main)
Solo 2 tablas:
- **students:** id, rut (único), name, grade
- **lunch_registrations:** id, student_id (FK), meal_type, timestamp

### API REST (main)
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/students | Listar estudiantes |
| GET | /api/students/:rut | Buscar por RUT |
| POST | /api/students | Crear estudiante |
| PUT | /api/students/:id | Actualizar estudiante |
| DELETE | /api/students/:id | Eliminar estudiante |
| POST | /api/lunches | Registrar colación |
| GET | /api/lunches/today | Registros del día |
| GET | /api/lunches/history | Historial con filtro fechas |
| DELETE | /api/lunches/:id | Eliminar registro |
| PUT | /api/lunches/:id | Actualizar tipo comida |

### Funcionalidades (main)
- Escaneo USB de código de barra (Code128) → registro automático
- Detección de tipo de comida por horario: <13:00 desayuno, 13-16 almuerzo, >16 once
- Audio feedback con Web Audio API (880Hz éxito, 440Hz duplicado, 220Hz no encontrado)
- Debounce contra lecturas duplicadas rápidas
- Historial con filtro de fechas + exportación Excel (.xlsx)
- CRUD completo de estudiantes con búsqueda en tiempo real
- Generación de códigos de barra para impresión

---

## 8. Estado del código — Rama `WIP` (en desarrollo activo, +5 commits adelante de main)

### Historial de commits WIP
| Hash | Fecha | Descripción | Autor |
|---|---|---|---|
| `7f8c73d` | 02/04/26 | WIP sistema base + modulo (auth JWT, BD relacional, refactor frontend) | Humberto |
| `3effb8f` | 02/04/26 | MOD ventana almuerzos admin | Humberto |
| `0e94b9b` | 11/04/26 | ADD vista para resumen y generación de registros + MOD formato de informes | Humberto |
| `ebea21a` | 12/04/26 | ADD Migración Excel (endpoint bulk-sync + parser completo) | Humberto |
| `41bc8df` | 15/04/26 | MOD Tablas BD y migración Excel (tablas _detalle, complemento, snapshot) | Humberto |

### Cambios totales desde main: +2951 líneas, -85 líneas en 11 archivos

### 8.1 Estructura actual (WIP)
```
ColegioSanAgustinComedores/
  backend/
    .env                    # Variables de entorno (no versionado)
    db.js                   # Pool de conexión PostgreSQL (21 líneas)
    init.sql                # Esquema DDL completo: ~20 tablas (225 líneas)
    seed.js                 # 5 alumnos ficticios con perfiles 100% completos (186 líneas)
    server.js               # Express + toda la lógica: auth, escaneo, CRUD, migración Excel (1607 líneas)
    middleware/
      auth.js               # verifyToken + verifyRole
    package.json
  frontend/
    src/
      main.jsx              # Punto de entrada: AuthProvider + ProtectedRoute
      App.jsx               # Layout principal (glassmorphism + navbar), importa BarcodeScanner
      Login.jsx              # Formulario login → redirige según rol
      AdminHub.jsx           # Hub de navegación admin
      AdminDashboard.jsx     # Resumen del día + generación de reportes PAE matriciales (440 líneas)
      Students.jsx           # Padrón estudiantil + carga Excel + ficha completa por alumno (627 líneas)
      Nav.jsx                # Navegación
      TestBarcodes.jsx       # Generación e impresión de códigos de barra
      components/
        BarcodeScanner.jsx   # Escáner USB: keydown events, timeout anti-doble, alertas
        HistoryPanel.jsx     # Panel historial del día + exportación XLSX
      context/
        AuthContext.jsx      # Context global auth (withCredentials, login, logout, restaurar sesión)
      utils/
        audioNotifier.js     # playBeep(type) — Web Audio API
      index.css              # Estilos completos (1298 líneas)
  docs/
    datos_ficticios_alumnos.xlsx    # Excel de prueba para migración
    mapeo_excel_bd.md               # Documentación del mapeo columna Excel → tabla BD
    estructura_proyecto.md
    resumen_funcionamiento_proyecto.md
```

### 8.2 Seguridad: JWT + Cookies HttpOnly

**Archivos:**
- `backend/middleware/auth.js` — middleware con `verifyToken` y `verifyRole`

**Flujo de autenticación:**
1. Usuario envía correo + password a `POST /api/auth/login`
2. Backend verifica con `bcryptjs` contra hash en tabla `usuarios`
3. Si es válido, genera JWT con `{ id, correo, rol }`, expira en 8h
4. Token se guarda como **cookie HttpOnly** (no accesible desde JavaScript del navegador = protección XSS)
5. CORS configurado con `credentials: true` + `origin: http://localhost:5173`
6. `GET /api/auth/me` restaura sesión al recargar (React no puede leer cookies HttpOnly directamente)
7. `POST /api/auth/logout` limpia la cookie

**Roles:**
| Rol | Correo prueba | Password | Accesos |
|---|---|---|---|
| **lector** | lector@colegio.cl | 1234 | Vista de escáner + historial |
| **admin** | admin@colegio.cl | 1234 | Todo: dashboards + reportes + CRUD + carga Excel |

### 8.3 Base de datos completa (20 tablas)

Se pasó de 2 tablas simples a un **DER completo**:

| Tabla | Propósito |
|---|---|
| `nivel_ensenanza` | Pre-básica, básica, media |
| `curso` | Cursos con referencia a nivel |
| `alumno` | Datos del alumno: RUT, nombres, fecha nacimiento, sexo, dirección, `codigo_barra` (único), `activo` (borrado lógico), `fecha_actualizacion` |
| `alumno_complemento` | **NUEVO:** Datos extendidos: lista, estado, foto, condicionalidad, nacionalidad, religión, PIE, etnia, colegio procedencia, retira titular/suplente |
| `alumno_excel_snapshot` | **NUEVO:** JSONB del raw payload del Excel importado + fecha importación (para trazabilidad) |
| `persona_contacto` | Apoderados y contactos (rut, nombre, teléfono, email) |
| `persona_contacto_detalle` | **NUEVO:** Datos extendidos del contacto: fecha nac, comuna, empresa, estudios, profesión, nacionalidad |
| `relacion_alumno_persona` | Vínculo alumno↔contacto con tipo relación, autorización foto, contacto principal, vive con alumno |
| `matricula` | Matrícula por año: alumno + curso, fecha inscripción/retiro, nuevo/repetidor |
| `pago` | Forma de pago del apoderado |
| `pago_detalle` | **NUEVO:** Datos bancarios extendidos: co_banco, tarjeta, vencimiento |
| `programa_apoyo` | Flags: vulnerable, prioritario, preferente, pro_retencion |
| `salud` | Condiciones: asma, diabetes, epilepsia + observaciones |
| `salud_detalle` | **NUEVO:** Datos físicos: peso, talla, grupo sangre, problemas visuales/auditivos/cardiacos/columna |
| `emergencia` | A quién avisar, teléfono, dónde trasladar |
| `emergencia_detalle` | **NUEVO:** Seguro, isapre, observaciones emergencia |
| `usuarios` | Correo, password_hash (bcrypt), rol (admin/lector) |
| `beneficiario_alimentacion` | Si el alumno tiene beca JUNAEB activa (con fechas inicio/fin y motivo) |
| `restriccion_dietaria` | Alergias y restricciones vigentes con fecha |
| `lunch_registrations` | Registro de colaciones: id_alumno, fecha, hora, tipo_alimentacion, `es_beneficiario_al_momento` |

**Cambios clave en lunch_registrations:**
- Se eliminó `ON DELETE CASCADE` del id_alumno para no perder históricos
- Se agregó `es_beneficiario_al_momento` (boolean) — snapshot de si tenía beca al momento del registro
- Campos separados `fecha_entrega` y `hora_entrega` además del timestamp

### 8.4 API REST completa (WIP)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | /api/auth/login | público | Login con correo + password |
| GET | /api/auth/me | autenticado | Restaurar sesión desde cookie |
| POST | /api/auth/logout | autenticado | Cerrar sesión (limpiar cookie) |
| GET | /api/students/scan/:barcode | lector/admin | Escanear código de barra (busca alumno, verifica activo, beneficiario, restricciones, duplicado hoy) |
| POST | /api/lunches | lector/admin | Registrar colación (verifica alumno activo, snapshot beneficiario) |
| GET | /api/lunches/history | lector/admin | Historial con filtros (from, to, curso, beneficiario) |
| GET | /api/admin/alimentacion/resumen-dia | admin | **NUEVO:** Resumen del día: conteos por tipo, beneficiario, últimos 5 registros |
| GET | /api/admin/reportes/asistencia | admin | **NUEVO:** Reporte matricial de asistencia (filtro desde/hasta/tipo) — devuelve data cruda para generar Excel en frontend |
| GET | /api/admin/reportes/recurrentes | admin | Reporte de no beneficiarios que consumen recurrentemente |
| GET | /api/courses | autenticado | Lista de cursos (para selects) |
| GET | /api/students | admin | Listar alumnos con curso y status beneficiario |
| POST | /api/students/bulk-sync | admin | **NUEVO:** Migración masiva desde Excel — upsert inteligente por RUT con comparación de fecha_actualizacion |
| GET | /api/students/:id/details | admin | Detalle completo de alumno (JOIN de todas las tablas: salud, emergencia, contactos, pago, apoyo, beneficio, restricciones, complemento, snapshot Excel) |

### 8.5 Migración masiva de Excel (NUEVO — commits 12/04 y 15/04)

**Endpoint:** `POST /api/students/bulk-sync`

**Lo que hace:**
1. Recibe un array de filas del Excel (leído en el frontend con `xlsx`)
2. Para cada fila, normaliza headers (quita tildes, minúsculas, fuzzy match con aliases)
3. Extrae: alumno, curso, contactos (padre, madre, apoderado, apoderado2, tutor), salud, emergencia, pago, programa apoyo, beneficiario, restricciones dietarias, complemento escolar, datos bancarios extendidos
4. **Lógica de actualización por RUT:**
   - Si `fecha_actualizacion` del Excel = BD → se omite
   - Si BD es más reciente que Excel → se omite (warning de seguridad)
   - Si Excel es más reciente → se actualiza todo
   - Si el alumno no existe → se inserta nuevo con todos los datos
5. Upsert inteligente: solo actualiza campos que realmente cambiaron (comparación valor por valor)
6. Guarda snapshot del JSON crudo del Excel en `alumno_excel_snapshot`
7. Todo dentro de una transacción (BEGIN/COMMIT/ROLLBACK)
8. Retorna summary: `{ total, inserted, updated, unchanged, warnings, errors }`

**Parser de Excel (dentro de server.js):**
- `parseStudentRow()` — función de ~200 líneas que extrae TODO de una fila
- `pickRowValue(row, aliases)` — fuzzy match de headers (normaliza tildes, espacios, mayúsculas)
- `parseContactData(row, prefix, role)` — extrae datos de padre/madre/apoderado por prefijo
- `normalizeRutAndDv()` — maneja RUT con/sin puntos, con/sin guión
- `normalizeDateInput()` — maneja fechas ISO y serial de Excel (días desde 1899-12-30)
- `toBooleanOrNull()` — convierte "Sí", "true", "1", "Activo" → true; "No", "false", "Retirado" → false
- `parseBenefitActive()` — infiere si es beneficiario desde campo "Lista" (detecta "JUNAEB", "Beneficio")

**Frontend (Students.jsx):**
- Sección "Carga de BD" con botón para subir Excel
- Lee el Excel con `xlsx` en el navegador
- Muestra preview de las primeras 25 filas (RUT, nombre, curso, email)
- Botón "Sincronizar con BD" que envía todo al endpoint `bulk-sync`
- Muestra resultado: insertados, actualizados, sin cambios, errores por fila

### 8.6 Reportes PAE (NUEVO — commit 11/04)

**AdminDashboard.jsx ahora tiene 2 secciones:**

**1. Resumen del Día:**
- 4 tarjetas de stats: Almuerzos, Desayunos, Beneficiarios, No Beneficiarios (del día)
- Últimos 5 registros en tiempo real
- Botón recargar

**2. Generación de Reportes Excel:**
- 4 tipos de reporte:
  - **Asistencia General** — Todos, marcando D (desayuno) y A (almuerzo) por día
  - **Solo Almuerzo** — Solo registros de almuerzo
  - **Solo Desayuno** — Solo registros de desayuno
  - **No Beneficiarios JUNAEB** — Alumnos sin beneficio que consumieron
- 2 formatos:
  - **Detallado (PAE estándar):** Grilla matricial con los 31 días del mes, columnas D/A por día, una hoja por mes. Marca "X" donde corresponde.
  - **Resumido:** Tabla simple con totales de desayunos, almuerzos y días por alumno
- Selector de rango de fechas (default: mes actual)
- Genera archivo `.xlsx` directamente en el navegador

### 8.7 Ficha completa del alumno (Students.jsx)

Al hacer click en "Ver Ficha Local" de cualquier alumno, se abre un modal con:
- **Datos generales:** matrícula, fecha nac, sexo, email, teléfono, dirección, fecha actualización
- **Contactos de Responsables:** padre/madre/apoderado con detalle extendido (empresa, profesión, estudios, comuna)
- **Protocolo Médico:** asma, diabetes, epilepsia, observaciones + avisar a, trasladar a
- **Status Económico:** forma pago, banco, beneficio JUNAEB (vigente/vencido, fechas, motivo), restricciones dietarias, programa apoyo (vulnerable, prioritario, preferente)
- **Complemento Escolar:** lista, estado, foto, condicionalidad, nacionalidad, religión, PIE, etnia, colegio procedencia
- **Salud y Emergencia Extendida:** peso, talla, grupo sangre, problemas visuales/auditivos/cardiacos/columna, seguro, isapre
- **Datos Bancarios Extendidos:** co_banco, tarjeta, vencimiento
- **Datos crudos del Excel** (desplegable): JSON original importado con fecha de importación

### 8.8 Frontend completo

| Archivo | Líneas | Propósito |
|---|---|---|
| `main.jsx` | ~30 | Punto de entrada: AuthProvider + ProtectedRoute + React Router |
| `App.jsx` | ~50 | Layout glassmorphism + navbar + importa BarcodeScanner |
| `Login.jsx` | ~60 | Formulario login → redirige según rol |
| `AdminHub.jsx` | ~40 | Hub navegación admin (links a dashboard, estudiantes) |
| `AdminDashboard.jsx` | 440 | Resumen día + generación reportes PAE matriciales |
| `Students.jsx` | 627 | Listado por curso + carga Excel + ficha completa alumno |
| `Nav.jsx` | ~30 | Navegación con tabs |
| `TestBarcodes.jsx` | ~50 | Generación e impresión de códigos de barra |
| `components/BarcodeScanner.jsx` | ~200 | Escáner USB: keydown, timeout anti-doble, alertas, restricciones |
| `components/HistoryPanel.jsx` | ~150 | Panel historial + filtros + exportación XLSX |
| `context/AuthContext.jsx` | ~80 | Context global auth (withCredentials, login/logout, restaurar F5) |
| `utils/audioNotifier.js` | ~30 | playBeep(type) — Web Audio API 440Hz/880Hz |
| `index.css` | 1298 | Estilos completos: glassmorphism, responsive, stats cards, modales, tablas |

---

## 9. Ramas Git

| Rama | Estado | Descripción |
|---|---|---|
| `main` | Estable | MVP básico con registro de colaciones (2 tablas) |
| `test` | Integración | Rama de testing antes de main |
| `WIP` | **Desarrollo activo** | Sistema completo: auth + BD 20 tablas + migración Excel + reportes PAE + ficha alumno |
| `docs/readme` | Mergeada | Documentación README |
| `feature/backend-api` | Mergeada | API REST inicial |
| `feature/crud-estudiantes` | Mergeada | CRUD de estudiantes |
| `feature/navegacion` | Mergeada | Navegación + tabs + impresión barcodes |
| `feature/registro-scanner` | Mergeada | Registro con escáner USB + export Excel |
| `feature/responsive-ui` | Mergeada | Estilos responsive |

### Historial Git completo
```
41bc8df 15/04/26 Mod Tablas bd y migracion Excel
ebea21a 12/04/26 ADD Miigracion excel
0e94b9b 11/04/26 ADD vista para resumen y generacion de registros-MOD de formato de informes
3effb8f 02/04/26 MOD ventana almuerzos admin
7f8c73d 02/04/26 WIP sistema base+ modulo
c5e04f5 31/03/26 merge: test → main (documentación README)
af51dff 31/03/26 merge: test → main (MVP completo)
d8a58ce 21/03/26 Initial commit
```

---

## 10. Bitácoras — Actividades realizadas

### Actividades en bitácora (ambos integrantes)

```
#01 | 18/03 | 2h | Equipo | Primera reunión en dependencias del colegio
#02 | 19/03 | 3h | Equipo | Visita técnica: revisión de equipos disponibles en colegio
#03 | 19/03 | 5h | Equipo | Trabajo en requerimientos funcionales y no funcionales
#04 | 20/03 | 1h | Equipo | Reunión con Profesor Fabián para presentación de equipo y tema
#05 | 21/03 | 7h | Equipo | Trabajo en MVP
#06 | 22/03 | 8h | Equipo | Trabajo en MVP
#07 | 23/03 | 5h | Equipo | Modelado de BD en base a Excel de alumnos
#08 | 25/03 | 4h | Equipo | Creación de MER y MR
#09 | 25/03 | 4h | Equipo | Diseño de flujo de actividades
#10 | 26/03 | 2h | Equipo | Reunión de actualización con asistente social
#11 | 26/03 | 6h | Humberto | Investigación guías instalación de servers
#12 | 26/03 | 6h | Lucas | Investigación normativa PAE JUNAEB para diseño de reportes
#13 | 27/03 | 6h | Humberto | Trabajo en colegio revisión servidores, limpieza, instalación ubuntu (Fallida)
#14 | 27/03 | 6h | Lucas | Desarrollo flujo registro colaciones con escáner y página gestión estudiantes
#15 | 28/03 | 6h | Humberto | Trabajo en servidor personal para testeo e instalación ubuntu server
#16 | 28/03 | 6h | Lucas | Implementación diseño responsive y estilos CSS (Resultado parcial, problemas compatibilidad)
#17 | 01/04 | 1h | Equipo | Reunión con Ariel Andia revisión MVP
#18 | 02/04 | 6h | Equipo | Trabajo en colegio instalación ubuntu server (ok)
#19 | 02/04 | 3h | Humberto | Middleware Authentication, creación usuarios lector
#20 | 02/04 | 1h | Lucas | Investigación librerías generación códigos de barra
#21 | 02/04 | 1h | Lucas | Estudio flujo autenticación JWT con cookies HttpOnly
#22 | 02/04 | 1h | Lucas | Investigación lectura códigos de barra desde dispositivos móviles
#23 | 03/04 | 2h | Equipo | Reunión equipo revisión avances y lógica sistema-módulo
#24 | 03/04 | 6h | Humberto | init.sql: creación tablas e inicialización en PostgreSQL
#25 | 03/04 | 1h | Lucas | Configuración Axios y manejo centralizado peticiones HTTP
#26 | 03/04 | 1h | Lucas | Implementación notificaciones audio para confirmación registro
#27 | 03/04 | 2h | Lucas | Investigación y pruebas JsBarcode para tarjetas identificación
#28 | 03/04 | 2h | Lucas | Desarrollo lógica exportación datos a Excel para reportes
#29 | 04/04 | 5h | Humberto | Testeo y recopilación información Wireguard en server personal (Fallido)
#30 | 04/04 | 3h | Lucas | Desarrollo flujo completo registro colaciones: validación código barra, verificación alumno, registro BD
#31 | 04/04 | 2h | Lucas | Refinamiento estilos CSS y ajustes usabilidad vista escaneo y listado
#32 | 05/04 | 4h | Humberto | Testeo e investigación Tailscale en server personal
#33 | 05/04 | 2h | Lucas | Implementación manejo errores y feedback visual en proceso de escaneo
#34 | 05/04 | 2h | Lucas | Investigación y pruebas conexión remota al servidor (Sin éxito, pendiente VPN)
#35 | 06/04 | 2h | Equipo | Reunión equipo revisión actividades semanales
#36 | 08/04 | 6h | Equipo | Visita colegio, configuración VPN en servidor
#37 | 09/04 | 1h | Equipo | Reunión con profesor Fabián revisión avance
#38 | 09/04 | 3h(L)/1h(H) | Equipo | Reunión interna recapitulación y planificación tareas pendientes
#39 | 09/04 | 4h(L)/6h(H) | Equipo | Configuración VPN Tailscale y credenciales para acceso servidor CSAC
#40 | 10/04 | 1h | Equipo | Revisión flujo de escaneo en casino del colegio
#41 | 10/04 | 2h | Equipo | Creación diagrama BPMN proceso de escaneo de colaciones
```

**Horas totales por persona:** Lucas 105h | Humberto 105h

### Actividades NO en bitácora pero que EXISTEN en el código

1. AuthContext.jsx: Context API para provisión de estado de autenticación (usuario, rol) en toda la app
2. Pantalla de inicio de sesión (Login.jsx) con redirección automática según rol
3. Timeout preventivo en escaneo para filtrar lecturas duplicadas de pistola láser-USB
4. Endpoint GET /api/students/scan/:barcode para consulta en tiempo real
5. Validación lógica de alumno bloqueado (activo: false)
6. Validación cruzada de beneficiario al momento del registro
7. Endpoint POST /api/lunches para grabado transaccional
8. Vista AdminHub.jsx con cabecera e índice de módulos
9. Portal AdminDashboard.jsx con reportes de anomalías
10. Endpoint GET /api/students/:id/details con múltiples JOIN
11. Vista Students.jsx con ficha completa por alumno
12. Módulo HistoryPanel.jsx con registros históricos
13. Filtros dinámicos backend (from, to, curso, beneficiario) con WHERE condicional
14. Filtro rápido "Solo por hoy"
15. Refactorización de init.sql purgando columnas no usadas

---

## 11. Actividades pendientes reales

### Por desarrollar
1. **Carga y edición de Excel de beneficiarios de alimentación** — distinto al upload masivo de alumnos que ya existe. Falta el upload específico de la lista de beneficiarios JUNAEB
2. **Reporte PAE Matriz 1-31** — El reporte matricial detallado YA EXISTE en AdminDashboard.jsx (genera Excel con marcas D/A por día). Falta validar que el formato coincida exactamente con lo que exigen los auditores JUNAEB
3. **Resolver obtención de código de barras desde tarjeta del alumno** — Problema: el código solo es visible al momento de "imprimir la tarjeta" en SAP FullCollege, no está en un campo accesible del sistema. Si solo está visible al imprimir, hay que encontrar otra forma de asociar código → alumno
4. **Script impresora tarjetas PDF** — Generar tarjetas con código de barras estandarizado para impresora predeterminada
5. **Empaquetado VPS + SSL** — Empaquetar scripts para despliegue en VPS, configurar HTTPS con certificado SSL
6. **Reinicio automático de servicios** — Backend + PostgreSQL deben levantar solos tras corte eléctrico (RNF-11). Systemd service o similar
7. **Respaldo automático de BD** — Backup periódico de PostgreSQL en servidor CSAC
8. **Método alternativo de validación** — Búsqueda manual por RUT o nombre cuando el escáner falla (RF-06)
9. **Capacitación** — Enseñar a Carolina (asistente social) y encargados de casino a usar el sistema
10. **Pruebas en terreno** — Testear flujo real de escaneo en casino durante horario de alimentación
11. **Documentación técnica** — Estructura de código, endpoints, esquema BD para mantención futura
12. **Manual de usuario** — Para operadores (rol lector y administrador)
13. **Pruebas de carga** — Validar rendimiento con ~1000 alumnos (RNF-07)
14. **Validación con Carolina** — Que los reportes coincidan con el formato que usa actualmente el colegio

### Requerimientos funcionales (del documento oficial)
- **RF-01:** ✅ CRUD alumnos solo para admin
- **RF-02:** ✅ Carga de archivos Excel para incorporar/actualizar alumnos (bulk-sync)
- **RF-03:** ✅ Registro de alimentación por código de barras, un registro por período
- **RF-04:** ✅ Almacenamiento de cada entrega (alumno, fecha, hora, tipo)
- **RF-05:** ✅ Exportación de reportes con filtros (parcial — falta validar formato PAE exacto)
- **RF-06:** ❌ Método alternativo de validación de identidad (pendiente)
- **RF-07:** ✅ Autenticación con roles admin/lector
- **RF-08:** ✅ Página de control diario (BarcodeScanner + HistoryPanel)

### Requerimientos no funcionales
- **RNF-01:** ✅ Diseño modular (backend separado del frontend, tablas extensibles)
- **RNF-02:** ❌ Logo y colores institucionales (pendiente)
- **RNF-03:** ✅ Interfaz simple para personal no técnico
- **RNF-04:** ✅ Mensajes claros ante errores y acciones exitosas (alertas, audio)
- **RNF-05:** ✅ Búsqueda < 2 segundos (consultas directas por índice)
- **RNF-06:** ✅ Registro rápido (escaneo + debounce)
- **RNF-07:** ⏳ Pendiente validar con ~1000 alumnos
- **RNF-08:** ✅ Autenticación JWT + cookies HttpOnly
- **RNF-09:** ✅ Contraseñas cifradas con bcrypt
- **RNF-10:** ⏳ Pendiente configurar servicio
- **RNF-11:** ❌ Reinicio automático tras corte eléctrico (pendiente systemd)
- **RNF-12:** ✅ Integridad con FK, transacciones en bulk-sync
- **RNF-13:** ✅ Accesible desde navegadores web en red local

---

## 12. Rediseño Vista Lector — Modo Kiosco (decisión 17/04/2026)

### Problema detectado
La vista del lector (`App.jsx` + `BarcodeScanner.jsx`) está diseñada como una app para un operador técnico. Pero en la realidad del colegio, el PC del lector está en el **casino** y el flujo es: alumno pasa → escanea su tarjeta → sigue caminando. El sistema debe funcionar **casi solo**, como un kiosco/tótem autoservicio.

### Problemas específicos de la vista actual
- Tiene botón "Ver Historial" → **no debería estar** (el alumno no necesita ver historial)
- Tiene botón "Salir" prominente → peligro de que alguien lo toque y el sistema deje de funcionar
- El selector Desayuno/Almuerzo es manual → debería ser **100% automático por horario**
- El toggle "Modo Scanner ON/OFF" → confuso, debería estar siempre ON
- Muestra demasiada info del alumno → solo necesita nombre + feedback visual grande
- No tiene **búsqueda alternativa** (RF-06) para cuando el escáner falla o la tarjeta no lee

### Decisión: Rediseño a modo kiosco
- **Quitar** historial, selector de comida, toggle scanner, y todo lo que no sea escaneo
- **Agregar** zona de feedback GIGANTE con estados visuales claros (verde/amarillo/rojo)
- **Agregar** contador simple del día ("Hoy: 45 registros")
- **Agregar** botón "Buscar manualmente" que abre modal de búsqueda por RUT/nombre (**RF-06**)
- **Esconder** el logout (no fácilmente accesible)
- El tipo de comida se detecta **100% automático** por horario

### Nuevo endpoint requerido para RF-06
```
GET /api/students/search?q=... — Busca por RUT parcial o nombre parcial, solo alumnos activos, máximo 10 resultados
```

### Nuevo componente requerido
```
frontend/src/components/ManualSearch.jsx — Modal de búsqueda manual (RF-06)
```

---

## 13. Feedback real de Humberto (chat 17/04/2026)

### Sobre actividades "pendientes"
- Muchas tareas listadas como pendientes son **sub-tareas de cosas ya hechas** (ej: configurar .env es parte del MVP)
- El **file upload masivo ESTÁ HECHO** (`POST /api/students/bulk-sync`)
- Lo que REALMENTE falta:
  1. Upload y edición del **Excel de beneficiarios** (distinto al bulk-sync de alumnos)
  2. Resolver **de dónde sacan el código de barras** de la tarjeta SAP FullCollege
  3. Cita textual: _"Si solo está visible al momento de 'imprimir la tarjeta' vamos a estar hasta el pico cargando datos"_

### Gap en bitácora de Humberto
- Última entrada registrada: 10/04/2026
- Gap de **una semana completa** (11/04 → 17/04) sin registros
- En ese período se hizo lo más pesado: refactorización, reportes PAE, importación masiva, ficha estudiantil, documentación
- Hay **22 actividades** que existen en el código pero NO están registradas en ninguna bitácora
