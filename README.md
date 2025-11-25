# Proyecto MBA

Este repositorio contiene el dashboard estadístico para DIVEMOTOR. Consulta `BRIEFING.md` para una descripción técnica completa del objetivo del sistema, la estructura de datos y el plan recomendado para soportar la carga del CSV con 10,741 registros sin crashear la UI.

## Ejecutar localmente
1. Instala dependencias (`npm install`). Si el entorno tiene restricciones de red, revisa que el registro de npm sea accesible.
2. Inicia el servidor de desarrollo con `npm run dev` y abre http://localhost:5173.
3. Importa el archivo `public/BBDD x.csv` desde la interfaz; las transformaciones de categorías y vendedores se calculan en un Web Worker para evitar bloqueos de la UI.
