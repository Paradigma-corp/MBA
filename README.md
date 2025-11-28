# Proyecto MBA

Este repositorio contiene el dashboard estadístico para DIVEMOTOR. Consulta `BRIEFING.md` para una descripción técnica completa del objetivo del sistema, la estructura de datos y el plan recomendado para soportar la carga del CSV con 10,741 registros sin crashear la UI.

## Ejecutar localmente
1. Instala dependencias (`npm install`). Si el entorno tiene restricciones de red, revisa que el registro de npm sea accesible.
2. Inicia el servidor de desarrollo con `npm run dev` y abre http://localhost:5173.
3. Importa el archivo `public/BBDD x.csv` desde la interfaz; las transformaciones de categorías y vendedores se calculan en un Web Worker para evitar bloqueos de la UI.

## ¿Cómo subir la base de datos (CSV)?
1. Inicia la app con `npm run dev` y abre http://localhost:5173.
2. En la tarjeta **“Carga de datos”** haz clic en **“Seleccionar CSV”**.
3. Escoge tu archivo `BBDD x.csv` (o cualquier CSV con las columnas indicadas en `BRIEFING.md`).
4. El archivo se parsea con PapaParse y se envía al Web Worker para procesar categorías y vendedores; el indicador de **Origen: CSV importado** confirma que se cargó correctamente.
5. Si quieres volver a los datos demo, pulsa **“Volver a demo”** en la misma tarjeta.
6. Asegúrate de que tu CSV incluya al menos estas columnas: `Nombre segmentación`, `Vendedor SAP`, `nombreVendedor`, `Unidades UN`, `ingresos`, `costos`, `margen`.

### Filtros rápidos de análisis
- Tras cargar el CSV (o con los datos demo), usa la tarjeta **“Filtros de análisis”** para acotar los cálculos por **Nuevos / Usados (línea de negocio)** y por **Año** (puedes marcar varios a la vez).
- El contador de registros filtrados confirma cuántas filas se están usando en las visualizaciones, KPIs y el resumen estadístico.
- Si tu CSV incluye una columna de línea de negocio, nombrala como `lineaNegocio`, `Linea de negocio` o `Línea de negocio` para que el filtro la detecte automáticamente; de lo contrario, el selector mostrará solo la opción “Todos”.

### Unidades y formato de las métricas
- Los KPIs superiores de ingresos, costos y margen se muestran en **millones de USD (M)** para evitar cifras extensas.
- El margen promedio se expresa como **porcentaje sobre los ingresos** del subconjunto filtrado.
- Los totales resaltados en tarjetas y resúmenes siguen ese mismo formato para mantener la lectura ejecutiva.

### Correlaciones y dispersión
- La tarjeta **“Correlaciones”** muestra los coeficientes de Pearson para margen con ingresos, costos y unidades, recalculados según los filtros activos.
- Los dos gráficos de dispersión exhiben la relación margen-ingresos y margen-costos a nivel de fila (hasta 1,500 puntos para mantener la UI fluida), pero las correlaciones se calculan con el 100% de las filas filtradas (sin muestreo).
