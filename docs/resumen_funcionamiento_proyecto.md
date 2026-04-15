# Resumen Actual del Proyecto

Este documento resume, en formato operativo, para que sirve cada archivo principal del proyecto y como se conectan los flujos clave del sistema.

## 1) Backend

### backend/db.js
Configura el Pool de PostgreSQL leyendo variables de backend/.env.

### backend/init.sql
Define el esquema completo de BD.
Tablas principales:
- alumno
- alumno_complemento
- curso
- matricula
- persona_contacto
- persona_contacto_detalle
- relacion_alumno_persona
- pago
- pago_detalle
- programa_apoyo (incluye pro_retencion)
- salud
- salud_detalle
- emergencia
- emergencia_detalle
- beneficiario_alimentacion
- restriccion_dietaria
- lunch_registrations
- usuarios

Tambien incluye fecha_actualizacion en alumno para optimizar importaciones masivas por fila.

### backend/seed.js
Recrea tablas desde init.sql e inserta datos de prueba:
- usuarios admin y lector
- niveles y cursos
- alumnos y datos relacionados (contactos, salud, emergencia, pago, apoyo, beneficio, restricciones)

### backend/middleware/auth.js
Middleware de seguridad:
- verifyToken: valida JWT guardado en cookie HttpOnly.
- verifyRole: restringe acceso por rol (admin/lector).

### backend/server.js
Servidor Express y API REST.
Responsabilidades principales:
- autenticacion: login, sesion actual, logout
- escaneo y registro de colaciones
- historial y filtros
- reportes admin
- maestro de cursos
- gestor de estudiantes (listado, ficha)
- importacion masiva desde Excel con sincronizacion por RUT

Logica destacada de importacion masiva:
- compara fecha_actualizacion por fila
- si fecha Excel <= fecha BD, omite fila
- si fecha Excel > fecha BD, sincroniza alumno y tablas relacionadas
- inserta alumno nuevo con sus datos relacionados cuando no existe en BD
- persiste columnas Excel sin equivalente directo en tablas normalizadas dentro de:
   - alumno_complemento
   - persona_contacto_detalle
   - salud_detalle
   - emergencia_detalle
   - pago_detalle

### backend/package.json
Dependencias del backend: express, pg, dotenv, cors, cookie-parser, jsonwebtoken, bcryptjs.

## 2) Frontend

### frontend/index.html
Plantilla HTML base donde React monta la app en #root.

### frontend/vite.config.js
Config minima de Vite con plugin de React.

### frontend/eslint.config.js
Reglas de lint para JS/JSX y hooks React.

### frontend/package.json
Scripts y dependencias frontend:
- React + Router
- Axios
- XLSX
- JsBarcode
- Lucide icons

### frontend/src/main.jsx
Punto de entrada React.
Define rutas y proteccion por rol:
- /login
- /scanner (lector/admin)
- /admin (hub)
- /admin/alimentacion
- /admin/estudiantes

### frontend/src/context/AuthContext.jsx
Gestion global de sesion:
- restaura sesion con /api/auth/me
- login/logout
- axios con withCredentials para cookie HttpOnly

### frontend/src/Login.jsx
Pantalla de inicio de sesion.
Envia credenciales y redirige segun rol.

### frontend/src/App.jsx
Vista principal de lector:
- cabecera
- componente de escaneo
- boton para ver/ocultar historial

### frontend/src/components/BarcodeScanner.jsx
Flujo de escaneo y registro:
- lee codigo
- consulta alumno por codigo
- valida estado y registros duplicados
- registra colacion
- muestra alertas y reproduce sonidos de feedback

### frontend/src/components/HistoryPanel.jsx
Consulta historial por fechas y filtros.
Permite exportar resultados a Excel.

### frontend/src/AdminHub.jsx
Hub de entrada para admin con 2 accesos:
- modulo alimentacion
- gestor de estudiantes

### frontend/src/AdminDashboard.jsx
Panel admin de alimentacion:
- resumen diario
- actividad reciente
- generador de reportes Excel (detallado/resumido)

### frontend/src/Students.jsx
Gestor admin de estudiantes (2 apartados):
- Listado de estudiantes (por curso o global)
- Carga de BD (subida Excel + previsualizacion + sincronizacion)

Tambien muestra ficha detallada de alumno con datos familiares, salud y beneficios.

### frontend/src/TestBarcodes.jsx
Pantalla de prueba para generar/imprimir codigos de barra demo.

### frontend/src/utils/audioNotifier.js
Genera tonos de audio (exito/advertencia/error) usando Web Audio API.

### frontend/src/index.css
Estilos globales y de modulos (lector, historial, admin, reportes, responsive).

### frontend/src/App.css
Archivo heredado de plantilla inicial (actualmente no es pieza central del flujo).

### frontend/src/Nav.jsx
Navegacion simple de tabs (registro/estudiantes). Actualmente el flujo principal usa rutas de rol en main.jsx.

## 3) Documentacion

### README.md
Guia de instalacion, ejecucion, credenciales de prueba y resumen funcional.
Incluye migraciones puntuales para BD existente:
- pro_retencion en programa_apoyo
- fecha_actualizacion en alumno

### docs/estructura_proyecto.md
Resumen historico/arquitectonico (enfoque frontend alimentacion).

### docs/mapeo_excel_bd.md
Mapa completo de columnas del Excel `datos_ficticios_alumnos.xlsx` hacia tablas y columnas de BD.

### docs/resumen_funcionamiento_proyecto.md
Este documento.

---

## 4) Flujos Principales del Sistema

## 4.1 Flujo de autenticacion
1. Usuario entra a /login.
2. Frontend envia correo/password a /api/auth/login.
3. Backend valida y responde con cookie HttpOnly (JWT).
4. AuthContext consulta /api/auth/me y guarda usuario/rol.
5. main.jsx redirige segun rol a scanner o hub admin.

## 4.2 Flujo de escaneo y registro de colacion
1. Lector escanea codigo en BarcodeScanner.
2. Frontend llama /api/students/scan/:barcode con tipo de alimentacion.
3. Backend valida alumno, estado activo, restriccion y duplicidad diaria.
4. Si procede, frontend registra en /api/lunches.
5. UI muestra exito/advertencia/error y audio de feedback.

## 4.3 Flujo de historial y exportacion
1. Usuario abre HistoryPanel.
2. Selecciona rango de fechas y filtros (curso/beneficiario).
3. Frontend consulta /api/lunches/history.
4. Visualiza lista de registros.
5. Puede exportar resultados a Excel desde cliente.

## 4.4 Flujo de reportes admin alimentacion
1. Admin entra a /admin/alimentacion.
2. Dashboard pide /api/admin/alimentacion/resumen-dia.
3. Admin configura periodo, tipo y formato.
4. Frontend consulta /api/admin/reportes/asistencia.
5. Se genera archivo Excel matricial/resumen.

## 4.5 Flujo de gestion de estudiantes (listado)
1. Admin entra a /admin/estudiantes en apartado Listado.
2. Frontend pide /api/students.
3. Muestra cursos y padron global.
4. Puede buscar por RUT/nombre.
5. Abre ficha con /api/students/:id/details.

## 4.6 Flujo de carga masiva de BD desde Excel
1. Admin entra a apartado Carga de BD en Students.
2. Sube archivo .xlsx/.xls y ve previsualizacion.
3. Frontend envia filas a /api/students/bulk-sync.
4. Backend procesa fila por fila:
   - normaliza columnas
   - identifica alumno por RUT
   - compara fecha_actualizacion (fila vs BD)
   - si corresponde, hace upsert completo de tablas relacionadas
5. Backend responde resumen: inserted, updated, unchanged, errors.
6. Frontend muestra resultado y refresca listado.

## 4.7 Regla de rendimiento por fecha_actualizacion (fila)
1. Si fecha Excel == fecha BD: fila omitida (unchanged).
2. Si fecha Excel < fecha BD: fila omitida con warning.
3. Si fecha Excel > fecha BD: fila sincronizada.
4. Si alumno no existe: insercion completa.

## 4.8 Tablas nuevas para campos faltantes del Excel
1. alumno_complemento: guarda lista, estado, foto, condicionalidad, nacionalidad, religion, opta_religion, cursos_repetidos, colegio_procedencia, retira_titular, retira_suplente, centro_costo, diagnosticos PIE y etnia indigena.
2. persona_contacto_detalle: guarda fecha_nacimiento, comuna, empresa, telefono_empresa, estudios, profesion y nacionalidad de cada contacto.
3. salud_detalle: guarda peso, talla, grupo_sangre y banderas de problemas visuales, auditivos, cardiacos y de columna.
4. emergencia_detalle: guarda seguro, isapre y observaciones adicionales de emergencia.
5. pago_detalle: guarda co_banco, numero de tarjeta y fecha de vencimiento de tarjeta.

---

## 5) Observaciones Operativas

- El proceso masivo depende de que fecha_actualizacion realmente cambie cuando cambia cualquier dato del alumno.
- Si una fila no trae fecha_actualizacion, el sistema puede procesarla por comparacion de campos.
- Se recomienda mantener versionado de cambios de esquema (migraciones SQL) para ambientes ya inicializados.
