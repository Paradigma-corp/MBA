# Metodología y herramientas del módulo de correlación y regresión

Este documento resume, paso a paso, cómo se construyeron los módulos analíticos de correlación y regresión del dashboard, la metodología estadística aplicada y el rol de cada función/component.

## 1) Flujo general de datos
1. **Normalización de líneas de negocio**: todos los registros entrantes pasan por `normalizeBusinessLine` para unificar nombres de categorías (ej. "auto" → Automóviles). Esto garantiza que los cálculos operen sobre etiquetas consistentes.
2. **Construcción de series por periodo**: `buildCategorySeries` agrega ingresos, costos, margen y unidades por categoría y periodo (Año-Mes), permitiendo comparaciones temporales consistentes.
3. **Selección de categorías**: las series identifican las categorías disponibles; se priorizan las cuatro principales (Automóviles, Vans, Camiones, Buses) y luego se añaden categorías extra del dataset cargado.

## 2) Módulo de correlación entre categorías
1. **Cálculo de correlaciones 1 a 1**:
   - `computeCategoryCorrelations` toma las series y genera matrices por métrica (ingresos, costos, margen, unidades) usando coeficientes de Pearson.
   - Se alinea cada par de categorías por periodo común antes de calcular la correlación, evitando sesgos por fechas faltantes.
2. **Vista interactiva de la matriz**:
   - El componente `CategoryCorrelationModule` muestra la matriz 4x4 inicial (core) y permite elegir qué categorías van en filas (Y) y columnas (X) mediante selectores múltiples.
   - La tabla compacta incluye colores de calor proporcionales a la intensidad (valor absoluto de ρ) y un botón "Ver completo" para abrir la vista ampliada.
3. **Mapa de calor ampliado**:
   - En la modal se renderiza el mismo grid con etiquetas de fila y columna, scroll vertical/horizontal y mayor ancho mínimo para evitar celdas comprimidas.
4. **Correlación 1 vs varias**:
   - `computeOneVsManyCorrelations` agrega las otras categorías en un grupo y calcula la correlación de cada categoría frente a ese agregado por métrica.
   - El módulo muestra chips por métrica con el coeficiente y un resumen automático de fortaleza (débil, moderada, fuerte).

## 3) Módulo de regresión comparativa
1. **Modelo base**:
   - `buildRegressionModel` calcula β de cada categoría como promedio de margen observado y estima R² del modelo con esos coeficientes.
   - También calcula un R² alternativo sin Autos y el promedio de β de las otras tres categorías para medir la contribución diferencial de Autos.
2. **Interacción del usuario**:
   - `RegressionComparisonModule` permite editar manualmente cada β. Al cambiar valores, `recomputeModelWithBetas` recalcula R², el impacto de retirar Autos (ΔR²) y el promedio del grupo.
3. **Interpretación automática**:
   - El componente muestra: KPI de R², tarjetas de β con etiquetas de significancia relativa, barras horizontales de impacto y texto que compara β_Autos vs promedio del grupo y el cambio en R².

## 4) Consideraciones de robustez
1. **Entradas vacías o corruptas**: las funciones validan que los registros sean arrays y reemplazan valores no finitos por 0 para evitar fallos y mantener el render estable.
2. **Determinístico con filtros**: todos los cálculos se alimentan de los registros filtrados en tiempo real, por lo que la matriz, heatmap y regresión reflejan exactamente el subconjunto activo de datos.

## 5) Herramientas y librerías clave
- **React**: componentes funcionales con hooks (`useMemo`, `useEffect`, `useState`) para cálculos memoizados y estado local de selecciones.
- **Tailwind CSS**: se reutilizan las clases utilitarias del dashboard para bordes, colores, grid y controles (botones, selects, modales) manteniendo la estética existente.
- **Helpers analíticos propios** (`src/utils/analytics.js`): implementan Pearson, agregados por periodo, correlaciones 1:1 y 1 vs varias, y el modelo lineal con dummies.

## 6) Cómo explicarlo al docente
1. Mostrar que los datos se normalizan y se agrupan por periodo antes de cualquier cálculo.
2. Explicar que las correlaciones usan Pearson, alineando fechas comunes y destacando intensidades en el heatmap.
3. Resaltar que el usuario puede elegir filas/columnas para comparar distintas categorías sin perder la base Autos/Vans/Camiones/Buses.
4. En 1 vs varias, aclarar que una categoría se contrasta contra el agregado de las demás y se interpreta con umbrales de dependencia.
5. En regresión, comentar que cada β representa el peso marginal promedio por categoría; al editar β se recalculan R² y ΔR² para medir la independencia de Autos.
6. Cerrar indicando que los mensajes automáticos traducen los números a lenguaje de negocio (fuerte/moderado/débil, impacto alto/medio/bajo) para presentaciones.
