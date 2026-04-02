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
Panel (WIP) pensado para la _Asistente Social / Directiva_.
- Renderizado solo si en las rutas detecta un `req.user.rol === 'admin'`. Muestra inmediatamente el cruce estadístico pidiendo a base de datos la cuenta total de los almuerzos registrados en niños marcados como `No Beneficiario` (y que sus colaciones se permitieron bajo la etiqueta `es_beneficiario_al_momento = false`). 
