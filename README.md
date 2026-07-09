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
1. Ve a la sección **SQL Editor** en tu consola de Supabase.
2. Ejecuta el script **[database/designed.sql](file:///home/aer98e/Programmin-Proyects/HTML/Sesiones-Aprendizaje-Adminstrador/database/designed.sql)** para crear todas las tablas, relaciones y habilitar RLS.
3. Ejecuta el script **[database/rls_policies.sql](file:///home/aer98e/Programmin-Proyects/HTML/Sesiones-Aprendizaje-Adminstrador/database/rls_policies.sql)** para aplicar las políticas de seguridad que permiten lecturas públicas (SELECT) de forma anónima.

### 4. Poblar la Base de Datos (Seeding)
El proyecto incluye los currículos completos estructurados para Inicial (Ciclo I y Ciclo II). Ejecuta el siguiente comando para cargar la información curricular (edades, áreas, competencias, capacidades y desempeños) en tu base de datos de Supabase:

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
│   └── users_tables.sql      # Estructura y triggers para gestión de usuarios
├── src/
│   ├── api/
│   │   ├── supabase.js       # Inicialización del cliente Supabase
│   │   └── queries.js        # Consultas optimizadas a base de datos
│   ├── components/           # Componentes UI autónomos (Auth, Theme, Loader, Form, Toast)
│   │   ├── auth.js
│   │   ├── formManager.js
│   │   ├── templateLoader.js
│   │   ├── theme.js
│   │   └── toast.js
│   ├── styles/               # Hojas de estilo CSS segmentadas
│   │   ├── auth.css
│   │   ├── cards.css
│   │   ├── form.css
│   │   ├── layout.css
│   │   ├── toast.css
│   │   └── variables.css
│   ├── utils/
│   │   ├── docxParser.js     # Sanitizador XML y generador .docx cliente
│   │   └── state.js          # Estado global compartido de la aplicación
│   ├── main.js               # Orquestador e inicializador de componentes
│   └── style.css             # Archivo CSS maestro que importa submódulos
├── index.html                # Plantilla HTML principal (contenedores vacíos)
├── package.json              # Scripts npm y dependencias del proyecto
└── README.md                 # Documentación técnica (este archivo)
```

