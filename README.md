# Pive - Tu Estilo de Vida Inteligente (Mobile App)

> [!NOTE]
> **Migración a React Native & Expo**: Este proyecto ha sido migrado de su versión web (PWA) original a una aplicación móvil nativa compatible con iOS y Android usando **React Native** y **Expo**. La versión web legada se encuentra archivada en la carpeta [web-backup](file:///Users/luis.fonseca/Dev/Personal/pive/web-backup/).

**Pive** es una aplicación móvil diseñada para simplificar y potenciar tu camino hacia una vida más saludable. Utilizando inteligencia artificial avanzada (Gemini API), Pive analiza tus planes nutricionales, realiza un seguimiento de tus macros y te motiva a superar tus límites físicos.


## 🚀 Características Principales

- **Dashboard Inteligente**: Visualiza tus macros diarios (Proteína, Carbohidratos, Grasas) y calorías restantes de un vistazo.
- **Pive AI Advice**: Recibe consejos personalizados y motivadores basados en tu ingesta diaria y tus objetivos, con un estilo fresco y directo.
- **Escáner de Planes Nutricionales**: Sube fotos o PDFs de tu dieta y deja que la IA extraiga automáticamente los macros y organice tus opciones de comida.
- **Seguimiento de Composición Corporal**: Registra y visualiza tu evolución de peso, porcentaje de grasa y masa muscular con gráficas interactivas.
- **Récords de Fuerza**: Mantén un registro de tus levantamientos máximos (PRs) organizados por grupos musculares.
- **Registro de Hidratación**: Controla tu consumo de agua diario para asegurar un rendimiento óptimo.
- **Coach de Rutinas (Próximamente)**: Escaneo inteligente de rutinas de entrenamiento para un seguimiento automatizado.

## 🛠️ Tecnologías Utilizadas

- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Estilos**: [Tailwind CSS](https://tailwindcss.com/)
- **Animaciones**: [Motion](https://motion.dev/)
- **Gráficas**: [Recharts](https://recharts.org/)
- **Backend & Auth**: [Firebase](https://firebase.google.com/) (Firestore & Authentication)
- **IA**: [Google Gemini API](https://ai.google.dev/) (@google/genai)
- **Iconos**: [Lucide React](https://lucide.dev/)

## 📦 Instalación y Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone <url-del-repositorio>
   cd pive
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Configurar variables de entorno**:
   Crea un archivo `.env` en la raíz del proyecto y añade tus credenciales:
   ```env
   GEMINI_API_KEY=tu_api_key_de_gemini
   ```
   *Nota: Las credenciales de Firebase deben estar configuradas en `src/firebase-applet-config.json`.*

4. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```

## 📂 Estructura del Proyecto

- `src/components/`: Componentes reutilizables de la interfaz.
- `src/screens/`: Pantallas principales de la aplicación (Dashboard, Plan, Stats, Coach, Profile).
- `src/services/`: Lógica de integración con servicios externos (Gemini API).
- `src/hooks/`: Hooks personalizados para manejo de estado y autenticación.
- `src/firebase.ts`: Configuración e inicialización de Firebase.
- `public/`: Activos estáticos y manifiesto de la PWA.

## 📱 PWA (Progressive Web App)

Pive está configurada como una PWA, lo que permite instalarla en tu dispositivo móvil o escritorio para una experiencia similar a una aplicación nativa, con acceso rápido y funcionamiento fluido.

---

Desarrollado con ❤️ para potenciar tu vibra.
