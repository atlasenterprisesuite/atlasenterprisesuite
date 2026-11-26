# ATLAS 777 REVIEW — BME688: fuente verificada y prototipo

**Estado:** investigación incorporada como registro versionado en `data/research/hardware/bosch-bme688.json`. No implica sincronización con Supabase, dispositivo conectado ni mediciones reales.
**Autoridad:** Knowledge Atlas como índice de fuentes. Device OS / IoT como propietario futuro de telemetría. Evitar registros duplicados y datos fabricados.

## Procedencia

1. Producto oficial Bosch: https://www.bosch-sensortec.com/en/products/environmental-sensors/gas-sensors/bme688/
2. Datasheet oficial BST-BME688-DS000-03, rev. 1.3, febrero de 2024: https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bme688-ds000.pdf
3. Software oficial (BME AI-Studio, BSEC, Sensor API): https://www.bosch-sensortec.com/en/software-tools/software/bme688-and-bme690-software
4. Introducción oficial AI-Studio: https://www.bosch-sensortec.com/software/bme/docs/overview/getting-started.html
5. Documentación oficial de entrenamiento: https://www.bosch-sensortec.com/software/bme/docs/
6. Sensor API de Bosch, con licencia BSD-3-Clause: https://github.com/boschsensortec/BME68x_SensorAPI
7. Preguntas frecuentes del fabricante: https://community.bosch-sensortec.com/knowledge-base-pg631enp/post/faqs---bme688-frapiOR0MlU5Sxb

El archivo JSON conserva las especificaciones seleccionadas, sus unidades, URLs, versión documental y clasificación de evidencia. Es una síntesis factual original, no una copia del manual ni de la biblioteca BSEC.

## Qué detecta y qué no

El BME688 integra medición de temperatura, humedad relativa, presión y resistencia/respuesta de gas. Algoritmos adicionales pueden derivar indicadores de calidad del aire o clasificadores entrenados. El CO₂-e no es lectura directa de CO₂; tampoco puede identificar de manera universal todas las sustancias. Un clasificador necesita datos etiquetados y validación independiente. El dispositivo no sustituye alarmas certificadas de seguridad ni instrumentos clínicos.

## Construir ATLAS Air Node — Prototipo A

**Componentes:** ESP32 de desarrollo de lógica 3,3 V; BME688 sobre una placa breakout con especificación de alimentación y pines accesibles; cable USB; cable I²C STEMMA QT/Qwiic, cuando coincidan conectores y niveles, o cables de prototipado; caja ventilada no sellada que no obstruya el sensor.

**Conexión I²C (breakout y ESP32 de lógica 3,3 V):**

| Breakout | ESP32 |
| --- | --- |
| 3V3 / VIN (solo si admite 3,3 V) | 3V3 |
| GND | GND |
| SDA | SDA asignado por la placa (frecuente GPIO21 en ESP32 clásico) |
| SCL | SCL asignado por la placa (frecuente GPIO22 en ESP32 clásico) |

La asignación exacta depende del ESP32. Consultar el pinout de **la placa breakout concreta** antes de encender. No conectar 5 V directamente al chip BME688 desnudo. Su VDD admite 1,71–3,6 V; VDDIO admite 1,2–3,6 V. Un breakout puede incorporar regulador y conversores de nivel: no asumirlos sin revisar su documentación.

**Procedimiento de validación:**

1. Conectar con USB y utilizar el ejemplo de I²C del entorno de desarrollo para verificar que la placa reporta 0x76 o 0x77.
2. Instalar el controlador Bosch SensorAPI o una integración explícitamente compatible con el BME688. Mantener una versión fijada y cumplir su licencia.
3. Registrar por puerto serie hora, modelo, unidad, temperatura, presión, humedad y resistencia de gas con mensajes de error explícitos. No inventar resultados si el sensor falla.
4. Comparar lecturas ambientales plausibles al observar variaciones normales; documentar incertidumbre, condiciones de calibración y versionado del firmware.
5. Solo después incorporar autenticación de dispositivos, validación de payload, transporte seguro y almacenamiento por tenant. Mantener la ingesta inactiva mientras no existan sensor y credenciales autorizadas.

No probar dispositivos con gases inflamables, tóxicos, desconocidos ni mezclas peligrosas. Emplear únicamente aire ambiente para la verificación básica.

## Construir ATLAS Electronic Nose — Prototipo B

Para entrenar un clasificador de aromas, usar como base el kit oficial Bosch de ocho BME688, AI-Studio y BSEC, según compatibilidad y condiciones de licencia. El tutorial de Bosch utiliza mediciones etiquetadas de **aire ambiente y aroma de café** como demostración. Las etapas son: estabilizar el kit según instrucciones, registrar sesiones, etiquetar correctamente, entrenar, evaluar con muestras independientes y exportar la configuración de BSEC. No confundir una clasificación de laboratorio con identificación química universal. Nunca publicar el software BSEC propietario como si fuera código libre.

## Contrato de telemetría propuesto (no desplegado)

`{ organization_id, device_id, captured_at, firmware_sha, sensor_model, temperature_c, humidity_percent, pressure_hpa, gas_resistance_ohm, data_quality, classifier_id, classifier_output }`

- SensorID/organizationID deben validarse en servidor; no aceptar `organization_id` declarado por un cliente como autoridad.
- Autenticar cada dispositivo, imponer límites de tasa, evitar replay y conservar auditoría.
- Mantener RLS por organización, separación entre datos reales/sintéticos y entre observaciones/interpretaciones.
- Publicar métricas IAQ o clasificación solamente cuando un controlador real y su pipeline verificado las produzcan.
- No almacenar ubicaciones precisas, material sensible ni datos personales si no son necesarios.

## Persistencia y control de calidad

- El registro JSON es un **dataset versionado en GitHub**, propuesto para su posterior incorporación a la base operativa de ATLAS.
- La tabla `public.atlas_library_assets` de Supabase almacena fuentes **de archivos autorizados** y rechaza la categoría de páginas web; no falsear su procedencia como `atlas_upload` o `chatgpt_library`.
- Antes de insertar fuentes web en Supabase, diseñar un ingreso gobernado usando una tabla de referencia compatible, RLS/tenant y una prueba SQL de lectura aislada; no crear una segunda fuente de verdad.
- Probar el JSON mediante `node --test tests/node/bme688-source-catalog.test.mjs` (integrado en el glob preexistente de `npm run test:node`).
- P0: ninguna afirmación de `connected`, `live`, `detecting`, `trained` o `verified in production` sin dispositivo, revisión de licencias, pruebas de ingesta y evidencia E2E.

**Clasificación ATLAS 777:** descripción técnica verificada por fuentes primarias; dispositivo propuesto; telemetría y reconocimiento real pendientes.

## Continuación RUN — Normalizador local sin persistencia (2026-11-26)

El adaptador real de software está en `tools/local-agent/lib/bme688-telemetry.mjs`, reutilizando el ATLAS Local Agent existente; no crea un agente nuevo ni un endpoint público.

- `normalizeBme688Frame` comprueba el modelo, los cuatro parámetros ambientales, fecha UTC reciente y contador de secuencia. Rechaza campos entrantes `org_id`, `tenant_id`, `provenance`, `co2_ppm` o clasificaciones arbitrarias; no les atribuye autoridad.
- `bme688UrbanTwinCandidates` produce cuatro observaciones candidatas compatibles con las métricas del esquema `atlas_urban_twin_observations`. Deliberadamente no proporciona `provenance`, `org_id`, `tenant_id` ni `evidence_refs`. Esas propiedades solo pueden establecerse después de verificar identidad, ámbito organizativo, vínculo de sensor y secuencia anti-replay en un servicio autorizado.
- El código no lee hardware ni utiliza credenciales, no envía telemetría, no inserta en Supabase y no fabrica mediciones. Las fechas/valores del test son **datos sintéticos de prueba**, no de sensores conectados.
- Pruebas de nodo: `node --test tools/local-agent/tests/bme688-telemetry.test.mjs`. Prueba local del 26-Nov-2026: 5/5 PASS; prueba inicial 4/5 FAIL y corrección posterior comprobada.
- Evidencia de integridad del código: blob Git `5e4f72fca7087f73f35a4aabbf2c2ac96231af25`; pruebas `3821d6425db9f8bbcb54ab2599c784c2046e219a`.
- Riesgos que permanecen bloqueantes: sensor físico inexistente o sin vinculación, almacenamiento de secuencias anti-replay atómico, sesión del Local Agent verificada, ingestión bajo RLS/tenant, licencia BSEC y pruebas E2E.

La arquitectura Urban Twin **ya contiene** tablas para `entities`, `bindings` y `observations` en `supabase/migrations/20261002184539_atlas_urban_twin_core.sql`; cualquier ingesta futura debe reutilizarlas. No aceptar nunca la identidad o el tenant que se declare dentro de una lectura IoT.
