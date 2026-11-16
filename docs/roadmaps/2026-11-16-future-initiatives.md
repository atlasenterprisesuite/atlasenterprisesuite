# ATLAS: de previsiones a trabajo verificable

Fecha: 16 de noviembre de 2026. Horizonte de investigación: 2027–2035.
Este documento organiza seis líneas dentro de ATLAS. No activa proveedores, tareas programadas ni dispositivos. No representa un compromiso de disponer de 6G, robots físicos o tratamientos médicos.

## Primera entrega: automatización contable

Reutilización: `packages/accounting`, Finance Control Center, navegación y pipeline canónico.
Ruta de la entrega: `/finance/accounting/reconciliation`.

Flujo: descargar plantilla CSV → seleccionar banco y libro → validar → comparar → revisar propuestas/pendientes → descargar evidencia JSON. Todo sucede en memoria del navegador. Datos reales de usuarios solo se usan cuando ellos seleccionan sus propios archivos.

Reglas: mismo importe con signo, moneda y referencia; ventana de 0–30 días; candidatos únicos en ambas direcciones. Los duplicados ambiguos permanecen pendientes. Importes y totales usan centavos enteros; el primer alcance admite USD/EUR/GBP/CAD/AUD. No hay acceso a cuentas bancarias, contabilización ni aprobación automática.

La evidencia registra filas normalizadas, nombres y hashes SHA-256 de los bytes originales, reglas, fecha y resultados. Es una exportación local sin firma ni identidad autenticada. Debe descargarse antes de cerrar; no es almacenamiento central ni bitácora de producción.

## Líneas y criterios de aceptación

| Línea | Base que se reutiliza | Siguiente entrega concreta | Evidencia necesaria y dependencia | Estado al iniciar |
| --- | --- | --- | --- | --- |
| IA y trabajo | Accounting, invoiceIngestion, `packages/execution`, ATLAS Copilot | Comparación local de banco/libro; después medir tiempo y errores en un proceso contable real | Pruebas de CSV, precisión, ambigüedad, importación y exportación. La siguiente fase requiere fuentes autorizadas, identidad/tenant, permisos y persistencia canónica antes de guardar aprobaciones | Primera entrega en esta rama; producción pendiente |
| Robótica | Device OS y contratos de ejecución existentes; no se encontró un controlador de robot físico listo en main | Inventariar un dispositivo propio y definir una tarea observable de lectura; seleccionar hardware antes del control de movimiento | Identidad del dispositivo, lectura de vuelta, límites físicos, parada de emergencia y ensayo supervisado. Requiere hardware disponible y autorización del propietario | Investigación / dependencia de hardware |
| Salud | `packages/health`, tipos de evidencia, repositorio de investigación de salud | Catálogo documentado de herramientas de IA médica por uso previsto, evidencia, estado regulatorio y limitaciones | Vincular cada afirmación a fuente primaria y fecha. Herramientas de uso clínico requieren validación y gobernanza específicas; un catálogo no diagnostica ni prescribe | Alcance de investigación definido; catálogo nuevo pendiente |
| Conectividad | `/telecom`, Device OS y agente local existentes | Medir conexión actual de dispositivos propios: estado observado, latencia, pérdida y evidencia por sesión | Mediciones reales y permisos de dispositivo/operador. El desarrollo de 6G no concede servicio ni elimina requisitos de acceso | Diagnóstico por dispositivo pendiente |
| Energía | Device OS para lecturas y Accounting para costos | Registro de consumo medido por equipo, con kWh, intervalo y costo calculado desde una tarifa introducida por el usuario | Lectura de medidor o archivo de proveedor autorizado. Separar energía observada, tarifa introducida y estimación; nunca presentar estimación como lectura | Modelo de medición por definir; medidor/fuente pendiente |
| Clima | Investigación, GPS y visualización geográfica existentes | Registro de tendencias y alertas oficiales de una ubicación elegida, empezando por Orlando si se mantiene la preferencia actual | Fuente oficial, ubicación, periodo, fecha de emisión y caducidad. Distinguir proyección climática de pronóstico meteorológico. Alertas automáticas requieren una tarea solicitada y configurada | Adaptador de fuentes y alertas pendientes |

## Orden de ejecución

1. Verificar la entrega contable y revisar un caso real con datos seleccionados por el usuario.
2. Integrar persistencia de conciliación en contratos existentes de banco/sesión solo después de revisar RLS, RBAC, revocación, aprobación y auditoría de extremo a extremo. No crear un almacén contable paralelo.
3. Ampliar diagnóstico de conectividad y medición de energía a dispositivos propios que estén realmente disponibles.
4. Construir los catálogos de evidencia de salud y clima sobre fuentes oficiales.
5. Incorporar control robótico cuando haya hardware y pruebas de seguridad verificables.

Cada línea conserva un ciclo independiente de aceptación y se integra mediante el mismo pipeline. Este orden evita que una dependencia física bloquee funcionalidades puramente digitales.

## Métricas antes de prometer resultados

- Contabilidad: propuestas correctamente aceptadas tras revisión, falsos positivos, movimientos pendientes, minutos por lote y reproducibilidad del reporte.
- Dispositivos/conectividad: porcentaje de lecturas comprobadas, latencia/pérdida observadas y recuperación de sesiones.
- Energía: cobertura del intervalo, unidad/origen de cada medición y diferencia entre estimación y medición.
- Salud/clima: porcentaje de registros con fuente primaria, vigencia y evidencia explícita.
- Robótica: tareas supervisadas completadas, fallos seguros y pruebas efectivas de parada.

No se han medido ahorros ni beneficios de producción en esta entrega. Los datos sintéticos utilizados por las pruebas son exclusivamente fixtures de prueba.

## Fuentes de las previsiones que motivan el programa

- OIT, exposición laboral a IA generativa: https://www.ilo.org/publications/generative-ai-and-jobs-2025-update
- IFR, World Robotics 2026: https://ifr.org/ifr-press-releases/news/five-million-robots-now-operate-in-factories-globally
- FDA, dispositivos médicos con IA: https://www.fda.gov/medical-devices/digital-health-center-excellence/artificial-intelligence-enabled-medical-devices
- UIT, IMT-2030: https://www.itu.int/en/itu-r/study-groups/rsg5/rwp5d/pages/imt.aspx
- AIE, energía e IA 2026: https://www.iea.org/reports/key-questions-on-energy-and-ai/executive-summary
- OMM, actualización climática 2026: https://wmo.int/resources/publication-series/wmo-global-annual-decadal-climate-update/global-annual-decadal-climate-update-2026-2035

## Puertas de publicación

Separar código y pruebas locales, revisión/PR, CI del mismo SHA, integración, despliegue Cloudflare y verificación P0/P1 con SHA exacto. Reutilizar los verificadores ya definidos en `docs/governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md`. Ninguna prueba local demuestra por sí sola una función en producción.
