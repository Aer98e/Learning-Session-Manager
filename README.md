# SesiónBuilder - Administrador de Sesiones de Aprendizaje 🏫✨

Generador inteligente y automatizado de sesiones de aprendizaje diseñado para docentes. Esta aplicación permite cargar una plantilla de Word (.docx) con marcadores predefinidos, completar un formulario dinámico que consulta el Currículo Nacional directamente desde Supabase y descargar la sesión de aprendizaje completada en formato Word.

La aplicación está diseñada para ser **100% serverless y estática**, lo que permite alojarla de forma gratuita en **GitHub Pages** y conectarla a una base de datos en la nube con **Supabase**.

---

## 🏗️ Arquitectura del Proyecto

* **Frontend**: Vanilla HTML5, CSS3 (con diseño responsive, tema oscuro/claro y efectos premium de Glassmorphic/HSL) y JavaScript (ES6+).
* **Entorno de desarrollo y empaquetado**: [Vite](https://vite.dev/) (para un hot reload ultrarrápido y compilaciones optimizadas).
* **Procesamiento de Word**: [PizZip](https://github.com/open-xml-templating/pizzip) y [Docxtemplater](https://docxtemplater.com/) ejecutados directamente en el lado del cliente (sin backend intermedio).
* **Base de datos**: [Supabase](https://supabase.com/) con Row Level Security (RLS) habilitado.

---

## 🛠️ Configuración e Instalación

### 1. Requisitos Previos
* Tener instalado [Node.js](https://nodejs.org/) (versión 18 o superior).
* Tener una cuenta y un proyecto creado en [Supabase](https://supabase.com/).

### 2. Variables de Entorno
Crea un archivo llamado `.env` en la raíz del proyecto y añade tus credenciales públicas de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto-id.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-public-key-aqui
```

### 3. Configurar la Base de Datos en Supabase
Para replicar la base de datos con la arquitectura modular y triggers automáticos, ve a la sección **SQL Editor** de tu consola de Supabase y ejecuta los siguientes scripts en el orden exacto:

1.  **Perfil y Gestión de Usuarios:** Ejecuta el contenido de [database/users_tables.sql](file:///e:/Programming_Proyects/Learning-Session-Manager/database/users_tables.sql) para crear las tablas de perfil y triggers de auto-creación.
2.  **Tablas Curriculares:** Ejecuta el contenido de [database/designed.sql](file:///e:/Programming_Proyects/Learning-Session-Manager/database/designed.sql) para crear el esquema del Currículo Nacional.
3.  **Políticas RLS Públicas:** Ejecuta el contenido de [database/rls_policies.sql](file:///e:/Programming_Proyects/Learning-Session-Manager/database/rls_policies.sql) para permitir lecturas públicas del currículo.
4.  **Estructura del Diseñador y Sesiones (JSONB consolidado v5):** Ejecuta el contenido de [database/designed_sessions_v5.sql](file:///e:/Programming_Proyects/Learning-Session-Manager/database/designed_sessions_v5.sql) para habilitar las tablas de sesiones y momentos con JSONB.
5.  **Mantenimiento Automático (Garbage Collector v6):** Ejecuta el contenido de [database/designed_sessions_v6_triggers.sql](file:///e:/Programming_Proyects/Learning-Session-Manager/database/designed_sessions_v6_triggers.sql) para activar la eliminación automática de momentos huérfanos.

### 4. Poblar la Base de Datos (Seeding)
Una vez creadas las tablas, pobla la base de datos con el Currículo Nacional Inicial oficial (edades, áreas, competencias, capacidades y desempeños) ejecutando el script seeder de Node:

```bash
npm run seed
```

### 5. Iniciar el Servidor de Desarrollo
Para levantar el servidor web local con Vite en `http://localhost:3000`:

```bash
npm run dev
```

---

## 📝 Guía de Creación de Plantillas (.docx)

Puedes diseñar la plantilla en Microsoft Word utilizando marcadores entre llaves simples `{MARCADOR}`. La aplicación analizará el documento y habilitará automáticamente los campos del formulario según los marcadores que encuentre.

### Marcadores Compatibles:

#### Generales
* `{FECHA}`: Se reemplazará con la fecha seleccionada formateada en texto (ej. "lunes, 8 de julio de 2026").
* `{EDAD}`: Se reemplazará con la edad seleccionada (ej. "3 años", "4 años", etc.).

#### Competencia Principal (Sección 1)
* `{AREA}` o `{AREA1}`: Nombre del área curricular seleccionada.
* `{COMPETENCIA1}`: Nombre de la competencia seleccionada.
* `{ESTANDAR1}`: Descripción del Estándar de Aprendizaje asociado a esa competencia y ciclo.
* `{CAPACIDADES1}`: Lista con viñetas de las capacidades que componen esa competencia.
* `{DESEMPEÑOS1}`: Lista con viñetas de los desempeños seleccionados por el docente para la sesión.

#### Competencia Secundaria (Sección 2)
*Si la aplicación detecta marcadores del bloque 2 en tu plantilla, habilitará automáticamente un segundo formulario de competencias secundarias:*
* `{AREA2}`: Nombre del área secundaria.
* `{COMPETENCIA2}`: Nombre de la competencia secundaria.
* `{ESTANDAR2}`: Estándar de la competencia secundaria.
* `{CAPACIDADES2}`: Lista con viñetas de capacidades secundarias.
* `{DESEMPEÑOS2}`: Lista con viñetas de desempeños secundarios seleccionados.

> [!IMPORTANT]
> **Sanitización de XML de Word**: 
> Microsoft Word suele fragmentar internamente el XML del archivo al editar marcadores o por errores de corrector ortográfico, lo que normalmente causa errores de compilación (`Duplicate open tag`) en las librerías tradicionales.
>
> Este proyecto cuenta con un **sanitizador automático en tiempo real** (`cleanWordXml`) que limpia el XML interno de Word, remueve etiquetas de corrector ortográfico y unifica los marcadores fragmentados de forma 100% transparente para el usuario antes de procesarlos.

---

## 🚀 Camino Evolutivo y Próximos Pasos
* **Portal de Acceso Completo (Actual)**: Por seguridad y control de recursos, inicialmente el generador está bloqueado por completo y requiere autenticación/registro.
* **Versión de Prueba / Demo (Pendiente)**: En el futuro se brindará una versión de prueba que permita interactuar con la herramienta sin necesidad de crear una cuenta, aunque con limitaciones en beneficios avanzados (como almacenamiento de preferencias y plantillas).

---

## 📦 Compilación para Producción (GitHub Pages)

Para generar la compilación optimizada y lista para alojarse en GitHub Pages (dentro del directorio `dist/`):

```bash
npm run build
```

---

## 📁 Estructura del Workspace

```text
├── database/
│   ├── seed_data/            # Datos JSON curriculares para el seed
│   ├── designed.sql          # Estructura de tablas y RLS de Supabase
│   ├── load_data.js          # Script NodeJS para poblar la base de datos
│   ├── rls_policies.sql      # Registro de políticas RLS aplicadas
│   ├── users_tables.sql      # Estructura y triggers para gestión de usuarios
│   ├── designed_sessions_v5.sql       # Estructura de momentos JSONB consolidada
│   └── designed_sessions_v6_triggers.sql # Trigger Garbage Collector de huérfanos
├── src/
│   ├── api/
│   │   ├── supabase.js       # Inicialización del cliente Supabase
│   │   └── queries.js        # Consultas optimizadas de guardado modular
│   ├── components/           # Componentes UI de orquestación
│   │   ├── auth.js           # Orquestador del flujo de login/registro
│   │   ├── formManager.js    # Controlador general del Wizard y cargado
│   │   ├── templateLoader.js # Procesador de documentos .docx del docente
│   │   ├── theme.js          # Switch e inicializador del tema oscuro/claro
│   │   ├── timelineManager.js # Motor de timeline interactivo y submomentos
│   │   └── toast.js          # Sistema dinámico de notificaciones flotantes
│   ├── styles/               # Hojas de estilo CSS modulares
│   │   ├── auth.css          # Estilos de login, registro y formularios de acceso
│   │   ├── cards.css         # Estilos de grilla y tarjetas de sesiones
│   │   ├── form.css          # Estilos generales del formulario y selects
│   │   ├── layout.css        # Contenedores, cabeceras y estructura de app
│   │   ├── toast.css         # Visualización y animación de notificaciones
│   │   ├── variables.css     # Tokens de colores y gradientes premium
│   │   ├── timeline.css      # Estilos del timeline, nodos intercalados y pestañas
│   │   └── print.css         # Reglas de paginación para exportación a PDF
│   ├── utils/
│   │   ├── docxParser.js     # Sanitizador XML y generador .docx cliente
│   │   ├── pdfGenerator.js   # Generador dinámico de impresión HTML a PDF
│   │   └── state.js          # Estado global compartido de la aplicación
│   ├── main.js               # Punto de entrada e importación CSS maestro
│   └── style.css             # CSS consolidado e importaciones
├── index.html                # Interfaz principal, modal flotante y datalist predictivo
├── package.json              # Scripts npm y dependencias del proyecto
└── README.md                 # Documentación del proyecto y onboarding (este archivo)
```

