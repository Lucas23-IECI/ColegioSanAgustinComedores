# Sistema de Registro de Colaciones — Colegio San Agustin

Sistema web para el registro y control de colaciones de estudiantes, con soporte para lectura de codigos de barra mediante escaner USB.

Desarrollado como MVP funcional para uso interno del comedor escolar.

---

## Tabla de contenidos

- [Descripcion general](#descripcion-general)
- [Tecnologias](#tecnologias)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos previos](#requisitos-previos)
- [Instalacion](#instalacion)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos](#base-de-datos)
- [Ejecucion](#ejecucion)
- [Funcionalidades](#funcionalidades)
- [API REST](#api-rest)
- [Flujo de trabajo Git](#flujo-de-trabajo-git)

---

## Descripcion general

El sistema permite registrar la asistencia de estudiantes al comedor escolar de forma rapida y confiable. El flujo principal consiste en escanear el codigo de barras del estudiante con un lector USB, lo que registra automaticamente su colacion segun el horario del dia (desayuno, almuerzo u once).

Ademas, incluye un modulo de gestion de estudiantes (CRUD completo), historial de registros con filtro por fechas y exportacion a Excel.

---

## Tecnologias

### Frontend

| Tecnologia       | Version | Proposito                          |
|------------------|---------|------------------------------------|
| React            | 19      | Interfaz de usuario                |
| Vite             | 8       | Bundler y servidor de desarrollo   |
| React Router DOM | 7       | Enrutamiento SPA                   |
| Axios            | 1.13    | Cliente HTTP                       |
| JsBarcode        | 3.12    | Generacion de codigos de barra     |
| XLSX             | 0.18    | Exportacion de datos a Excel       |
| Lucide React     | 0.577   | Iconos                             |

### Backend

| Tecnologia | Version | Proposito                      |
|------------|---------|--------------------------------|
| Express    | 5       | Servidor HTTP y API REST       |
| pg         | 8.20    | Cliente PostgreSQL para Node   |
| dotenv     | 17      | Variables de entorno           |
| cors       | 2.8     | Manejo de CORS                 |

### Base de datos

| Tecnologia | Version | Proposito                 |
|------------|---------|---------------------------|
| PostgreSQL | 16      | Base de datos relacional  |

---

## Estructura del proyecto

```
ColegioSanAgustinComedores/
  backend/
    .env               # Variables de entorno (no versionado)
    db.js              # Configuracion del pool de conexion PostgreSQL
    init.sql           # Esquema DDL (tablas students, lunch_registrations)
    seed.js            # Script de carga inicial de datos de prueba
    server.js          # Servidor Express con todos los endpoints
    package.json
  frontend/
    src/
      App.jsx          # Pagina principal: registro de colaciones
      Students.jsx     # Pagina CRUD de gestion de estudiantes
      Nav.jsx          # Componente de navegacion con tabs
      TestBarcodes.jsx # Pagina de generacion e impresion de barcodes
      main.jsx         # Punto de entrada con React Router
      index.css        # Estilos globales (responsive)
    vite.config.js
    package.json
```

---

## Requisitos previos

- Node.js 18 o superior
- PostgreSQL 16 (u otra version compatible)
- npm

---

## Instalacion

Clonar el repositorio:

```bash
git clone https://github.com/Lucas23-IECI/ColegioSanAgustinComedores.git
cd ColegioSanAgustinComedores
```

Instalar dependencias del backend:

```bash
cd backend
npm install
```

Instalar dependencias del frontend:

```bash
cd ../frontend
npm install
```

---

## Variables de entorno

Crear el archivo `backend/.env` con las siguientes variables:

```
DB_USER=tu_usuario
DB_HOST=localhost
DB_NAME=MVP_Colaciones
DB_PASSWORD=tu_password
DB_PORT=5432
PORT=5000
```

El archivo `.env` no esta versionado. Cada desarrollador debe crear el suyo.

---

## Base de datos

Crear la base de datos en PostgreSQL:

```sql
CREATE DATABASE "MVP_Colaciones";
```

Ejecutar el script de inicializacion que crea las tablas y carga datos de prueba:

```bash
cd backend
node seed.js
```

Esto genera dos tablas:

- **students**: id, rut (unico), name, grade
- **lunch_registrations**: id, student_id (FK a students con CASCADE), meal_type, timestamp

Y carga 7 estudiantes de prueba, incluyendo 2 con codigos de barra fisicos para testing con escaner.

---

## Credenciales de Acceso (Pruebas Locales)

Tras ejecutar el script `seed.js`, se generarán cuentas de prueba que son necesarias para la nueva capa de seguridad (JWT + Cookies):

| Rol | Correo | Contraseña | Accesos |
|---|---|---|---|
| **Lector** | `lector@colegio.cl` | `1234` | Tiene acceso estricto a la vista de escáner. |
| **Admin** | `admin@colegio.cl` | `1234` | Tiene acceso a los dashboards de reporte (Asistente Social). |

---

## Ejecucion

Iniciar el backend (puerto 5000):

```bash
cd backend
node server.js
```

Iniciar el frontend (puerto 5173):

```bash
cd frontend
npm run dev
```

Acceder a la aplicacion en `http://localhost:5173`.

---

## Funcionalidades

### Registro de colaciones

- Lectura de RUT mediante escaner USB de codigo de barras (Code128)
- Deteccion automatica del tipo de comida segun horario:
  - Antes de las 13:00 — Desayuno
  - Entre 13:00 y 16:00 — Almuerzo
  - Despues de las 16:00 — Once
- Audio feedback mediante Web Audio API:
  - Tono agudo (880 Hz): registro exitoso
  - Tono medio (440 Hz): ya registrado hoy
  - Tono grave (220 Hz): estudiante no encontrado
- Proteccion contra lecturas duplicadas rapidas (debounce con useRef)
- Tarjetas expandibles con detalle de cada registro
- Edicion y eliminacion de registros individuales

### Historial

- Filtro por rango de fechas (desde/hasta)
- Visualizacion de todos los registros del periodo seleccionado
- Exportacion a archivo Excel (.xlsx)

### Gestion de estudiantes

- Listado completo con busqueda en tiempo real
- Agregar nuevos estudiantes (RUT, nombre, curso)
- Editar estudiantes existentes (el RUT no es editable)
- Eliminar estudiantes con dialogo de confirmacion
- Validacion de RUT duplicado (HTTP 409)

### Codigos de barra

- Generacion visual de codigos Code128 para cada estudiante
- Vista optimizada para impresion

### Navegacion

- Tabs de navegacion sticky: Registro y Estudiantes
- Rutas: `/` (registro), `/estudiantes` (CRUD), `/test-barcodes` (impresion)

---

## API REST

Base URL: `http://localhost:5000/api`

### Estudiantes

| Metodo | Ruta               | Descripcion                              |
|--------|--------------------|------------------------------------------|
| GET    | /students          | Listar todos los estudiantes             |
| GET    | /students/:rut     | Buscar estudiante por RUT                |
| POST   | /students          | Crear estudiante (body: rut, name, grade)|
| PUT    | /students/:id      | Actualizar estudiante (body: name, grade)|
| DELETE | /students/:id      | Eliminar estudiante                      |

### Colaciones

| Metodo | Ruta               | Descripcion                                      |
|--------|--------------------|--------------------------------------------------|
| POST   | /lunches           | Registrar colacion (body: student_id, meal_type)  |
| GET    | /lunches/today     | Registros del dia actual                          |
| GET    | /lunches/history   | Historial por rango (query: from, to)             |
| DELETE | /lunches/:id       | Eliminar registro                                 |
| PUT    | /lunches/:id       | Actualizar tipo de comida (body: meal_type)        |

---

## Flujo de trabajo Git

Este proyecto sigue una variante de GitHub Flow con rama intermedia de pruebas:

```
main        Rama de produccion estable
  test      Rama de pre-produccion y validacion
    feature/<nombre>    Desarrollo de nuevas funcionalidades
    fix/<nombre>        Correccion de errores
    refactor/<nombre>   Mejoras internas de codigo
```

### Procedimiento

1. Crear rama de trabajo desde `test`:
   ```bash
   git checkout test
   git pull origin test
   git checkout -b feature/nueva-funcionalidad
   ```

2. Desarrollar y hacer commits con mensajes descriptivos:
   ```bash
   git commit -m "feat: descripcion del cambio"
   ```

3. Mergear a `test` con merge commit:
   ```bash
   git checkout test
   git merge feature/nueva-funcionalidad --no-ff
   ```

4. Validar en `test` y luego mergear a `main`:
   ```bash
   git checkout main
   git merge test --no-ff
   ```

### Prefijos de commits

- `feat:` — Nueva funcionalidad
- `fix:` — Correccion de bug
- `refactor:` — Reestructuracion de codigo
- `chore:` — Tareas de mantenimiento
- `docs:` — Documentacion