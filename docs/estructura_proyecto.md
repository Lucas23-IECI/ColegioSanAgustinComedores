# Arquitectura y Explicación de Archivos (Frontend Módulo de Alimentación)

A continuación se detalla el propósito de los archivos más críticos generados o refactorizados durante la fase arquitectónica del sistema:

## 1. Archivos Base y Enrutamiento

### `main.jsx`
Es el punto de entrada (Root) de la aplicación React. 
- Inicializa el *Router* (`BrowserRouter`).
- Configura el componente `<AuthProvider>` de modo que todo el árbol de React posea acceso al contexto del usuario iniciado de forma segura.
- Define el catálogo de rutas para mostrar una pantalla u otra (por ej: `<Route path="/login" .../>`).
- **Novedad principal:** Alberga el diseño de los `ProtectedRoute`. Este _wrapper_ interfiere cada cambio de página. Si un usuario que no tiene la cookie activa intenta entrar a `/scanner`, el archivo intercepta la solicitud y fuerza redirección al Login.

### `App.jsx`
Anteriormente administraba desde base de datos a estados visuales. Tras la refactorización (aplicando el principio _Single Responsibility_), `App.jsx` actúa exclusivamente como **Componente Orquestador y Contenedor Layout**. 
- Solo maqueta el diseño principal usando "Glassmorphism" y el Navbar corporativo.
- Importa adentro de su diseño de bloques al componente físico `<BarcodeScanner />`.

---

## 2. Lógica Funcional (Componentes)

### `components/BarcodeScanner.jsx`
El corazón físico de la terminal. 
- Contiene un `inputRef` manipulado para interceptar eventos de teclado (que es la naturaleza de los cañones infrarrojos USB).
- Se conecta al endpoint del Backend `/api/students/scan/:barcode`.
- Es totalmente autónomo y "toma decisiones" para pintar _badges_ de advertencia en caso de que detecte que el alumno:
  - Consumió repetidamente el plato.
  - Es **No Beneficiario** (Línea naranja de alerta ligera).
  - Padece **Restricciones Dietarias graves** (Alerta bloqueadora roja).

### `components/HistoryPanel.jsx`
Panel destinado al análisis rápido del día.
- Fue extraído de App para liberar carga gráfica a la memoria. 
- Cuenta con su propia lógica de obtención de datos a la BD (`fetchHistory`) usando interpolación de fechas.
- Se hace cargo de transformar las filas JSON en un archivo _XLSX_ nativo manipulando la librería `xlsx`.

### `utils/audioNotifier.js`
Archivo abstracto de utilería ("Helper").
- Contiene la función `playBeep(type)`.
- Se comunica directamente con los conectores DOM de la **Web Audio API** del navegador (en vez de usar un simple `<audio src="mp3">`). Modulando `Osciladores` en diferentes frecuencias (440Hz / 880Hz) reproduce el ruido característico de los supermercados para validar si el láser apuntó bien o si escaneó a alguien dado de baja.

---

## 3. Seguridad y Estados (Contexto)

### `context/AuthContext.jsx`
Servicio subyacente que opera globalmente gracias a la API _Context_ de React.
- **withCredentials:** Automáticamente intercepta los eventos puros de _Axios_ que salen hacia NodeJS y les pega el parámetro especial `withCredentials: true`, logrando que Google Chrome acepte incrustar la `Cookie HttpOnly` oculta durante cada salto que se haga.
- Ofrece las funciones públicas `login(correo, password)` y `logout()`, dictaminando con "useEffect" si el estudiante tiene credenciales vivas al hacer *refresh* (F5).

### `Login.jsx`
Vista pública estándar de formulario que procesa el ingreso inicial y se comunica con `AuthContext`.
- Si las credenciales fallan, avisa con un banner visual sin detener el componente.

### `AdminDashboard.jsx`
Panel de reportería general y visualización gráfica para la Directora, Encargados de Casino y Asistente Social.
- Presenta estadísticas clave del día actual y de rangos históricos.
- Genera visualizaciones y cruces estadísticos de raciones entregadas (beneficiarios vs. no beneficiarios).
- Permite descargar la planilla consolidada en formato Excel (XLSX).

### `AdminHub.jsx`
Menú central de navegación rápida para administradores y asistentes sociales.
- Enruta al administrador hacia los distintos módulos de gestión especializada: Alumnos, Beneficiarios, Usuarios, Auditoría del Sistema y Panel de Control (Kiosco).
- Valida accesos y roles a nivel visual.

### `Students.jsx`
Ficha y listado general de estudiantes para operaciones de secretaría escolar.
- Permite la visualización de cursos, matrículas y búsqueda inteligente de perfiles de alumnos.
- Permite realizar ediciones manuales de datos personales, contactos de emergencia y asignación de restricciones dietarias.
- Integra el disparador del proceso bulk-sync para actualizar masivamente a la comunidad escolar desde el Excel del software SAP FullCollege.

### `BeneficiariosAdmin.jsx`
Panel especializado para la asistente social Carolina Salinas.
- Administra de forma manual o masiva el estado de becas JUNAEB/PAE.
- Implementa importaciones de archivos Excel con opciones para generar marcas de colaciones de forma retroactiva o procesar la nómina PAE sin alterar el historial.
- Facilita la asignación rápida de códigos de barras de tarjetas TNE a las fichas de los beneficiarios.

### `UsuariosAdmin.jsx`
CRUD interactivo para cuentas de acceso al sistema.
- Permite crear, modificar y dar de baja usuarios especificando su nombre, correo, contraseña y rol asignado.
- Protege activamente la sesión del administrador autenticado impidiendo que se elimine a sí mismo del sistema.

### `AuditoriaAdmin.jsx`
Módulo de seguridad forense y auditoría.
- Consume de forma paginada el log de base de datos (`audit_log`).
- Dispone de filtros complejos de búsqueda por fecha, correo de ejecutor e IP de origen.
- Posee un visualizador interactivo de metadatos (JSONB) para analizar en detalle qué cambió en cada acción e importación, además de permitir la descarga de la bitácora a un reporte Excel.
