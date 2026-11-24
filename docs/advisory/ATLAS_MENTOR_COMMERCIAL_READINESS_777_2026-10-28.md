# ATLAS 777 REVIEW — Mentoría: primer lanzamiento comercial
Fecha: 2026-10-28 · Estado general: **NO-GO comercial transaccional** · Documento de preparación, NO una declaración de despliegue.

## 0. Reutilización y fuentes de verdad
- Repositorio: `atlasenterprisesuite/atlasenterprisesuite`, `main` base `6f7bc8bf7ccb4c50afb347281c934b4cf1925786`.
- Arquitectura y políticas: [AGENTS.md](../../AGENTS.md), [protocolo autónomo](../governance/ATLAS_MASTER_AUTONOMOUS_EXECUTION_PROTOCOL.md).
- Producto candidato: [ATLAS Advisory Office](ATLAS_ADVISORY_OFFICE.md), `packages/advisory/src/index.ts`, `/advisory/readiness`.
- Primer piloto identificado en código: **AW Finance Advisory Solutions**, firm #001. Esto NO acredita uso real, cliente pagador ni ingresos.
- Cotizaciones de referencia en código: `packages/network/src/pricing.ts`. Actualmente se definen `ATLAS Core` $29/mes por usuario, `Pro` $59/mes por usuario, `Business` $149/mes por organización y `Enterprise` desde $999/mes por organización; **no se afirma checkout, facturación, ni disponibilidad comercial activa**. Plan anual y asientos adicionales se regulan por el mismo código.
- `README.md`: Cloudflare es el objetivo público principal; Vercel es opcional salvo que una release lo marque obligatorio. No duplicar servicios ni proveedores.
- `docs/audit/2026-09-13-atlas-module-readiness-matrix.md` es una auditoría histórica, no certificación actual.

## 1. Dictamen basado en evidencia
| Control | Observación 2026-10-28 | Dictamen |
|---|---|---|
| Empresa | Sunbiz documento L26000514910, ATLAS ENTERPRISE SUITE LLC, ACTIVE, filed 2026-10-05 | Registrada; campo FEI/EIN reporta NONE, validar personalmente |
| `main` | HEAD `6f7bc8bf7ccb4c50afb347281c934b4cf1925786` | Fuente inicial verificada, NO SHA servido en producción |
| Ejecución atómica | PR #917 en borrador; 8 workflow runs success para head `a5b8eba9b8c08fbce3ac654bac40c55be022a3c3` | Green CI en PR, NO implantación/worker/E2E |
| ChatGPT OAuth | PR #938 en borrador, head observado `9622ed1f33b05b06383be4a26a89e2f5181b2b0a`; 4/7 workflows failed | NO-GO; error TS2345 en `packages/atlas-mcp/src/chatgptOAuthResource.ts:49:65` — `Uint8Array<ArrayBufferLike>` no asignable a `BufferSource` |
| Vercel live | estado combinado `Vercel – atlas-enterprise-suite-live`: failure en `main` | Investigar configuración/check; NO inferir automáticamente falla de Cloudflare |
| HubSpot | Lectura autorizada: 0 DEAL en búsqueda total; onboarding reportado incompleto | No contar conversiones/ventas; no alterar CRM sin aprobación |
| Producto | Advisory persistencia, RBAC/RLS y rutas descritas en repo | Requiere comprobación E2E exacta de producción y de cada operación vendida |
| Ventas | Sin clientes pagadores verificados en las fuentes examinadas | 0 ventas **verificadas**, no prueba de ausencia en otros sistemas |

Fuente Florida: https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?InquiryType=EntityName&SearchTerm=ATLAS+ENTERPRISE+SUITE+LLC
Fuente IRS (EIN gratis): https://www.irs.gov/businesses/small-businesses-self-employed/get-an-employer-identification-number
Fuente impuestos FL: https://www.floridarevenue.com/taxes/eservices/Pages/registration.aspx

## 2. Decisión de producto (no lanzar 40 módulos simultáneamente)
**Nicho inicial:** despachos pequeños de contabilidad/bookkeeping y asesoría a PYMES que necesitan seguimiento de clientes, expedientes/engagements, control de cobros y estado de tareas.

**Mensaje provisional:** «Una plataforma para organizar clientes, compromisos, tareas y visibilidad operativa de tu despacho». No prometer conciliación bancaria automática, contabilidad completa, filing de impuestos, firma electrónica, pagos, conectores reales, IA o automatizaciones desatendidas sin validación por funcionalidad.

**Alcance de demo segura:** uso de organización de prueba con datos sintéticos, alta/consulta de clientes y engagements, recorrido de evidencias de Business Launch 360, navegación a cuentas por cobrar solo si verificada, y estados vacíos/error honestos. No procesar información real de clientes antes de cerrar P0 y contrato de tratamiento de datos.

**Precio:** utilizar las SKUs actuales solo como hipótesis comerciales. No publicar ni cobrar hasta determinar derechos/entitlements, impuestos aplicables, facturación real, política de cancelación y costos variables. No crear un segundo catálogo de precios.

## 3. Matriz P0 de certificación — Fail Closed
Se reutilizan `data/ops/global-production-verification.json`, `scripts/verify-production-p0.mjs`, `scripts/verify-global-production.mjs`, sin verificador duplicado.

| ID | Prueba de aceptación negativa / positiva | Evidencia requerida | Estado |
|---|---|---|---|
| P0-01 | Usuario sin sesión no lee/crea clientes; refresh expira y revoca autorización | TDD aislado + E2E autenticación | OPEN |
| P0-02 | Miembro org A no puede leer, actualizar ni listar clientes/engagements de org B, incluso manipulando parámetros | RLS/RPC tests con dos tenants + auditoría | OPEN |
| P0-03 | Rechazar `org_id` aportado por navegador en escrituras y tokens revocados; miembro retirado pierde acceso | Pruebas por función/RPC y revocación | OPEN |
| P0-04 | Repetición/reintento/doble click no duplica engagement, invoice ni efecto externo | Contratos de idempotencia y concurrencia | OPEN |
| P0-05 | Proveedor de pago/calendario/firma desconectado no se presenta conectado ni acepta operación | TDD negativo y estado UI | OPEN |
| P0-06 | Base, typecheck, tests, análisis de seguridad, build y rutas críticas completos en HEAD exacto | URLs de Actions por SHA; sin suponer éxito de otra rama | OPEN |
| P0-07 | Cloudflare desplegado sirve exactamente el SHA esperado; health, CSP/HSTS y rutas críticas pasan | Cabeceras `x-atlas-version-id` y `x-atlas-version-tag`, logs y E2E | OPEN |
| P0-08 | Privacidad: consentimiento, retención, exportación/borrado, control de acceso por roles; sin credenciales en cliente ni logs | Evidencia de prueba y revisión documental | OPEN |
| P0-09 | Facturación/entitlements si se ofrece pago: precios server-side, impuestos, cancelaciones, reintentos y prueba de no cargo sin autorización | sandbox de pago, reconciliación y recibos | OPEN |

**P1 documentado:** WCAG/teclado/lector, traducciones, responsive, métricas de desempeño, observabilidad, documentación de soporte. Ningún P1 compensa P0. NO-GO si falta evidencia.

## 4. Paquete de piloto: AW Finance, sin uso real inferido
**Duración de estudio sugerida:** 14 días **después** del gate P0. Fecha aún no fijada.

**Entrada:** consentimiento y acuerdo piloto firmado; responsable autorizado; org/tenant creado; roles mínimos; 5 casos sintéticos de prueba, luego datos reales solo con consentimiento y controles verificados.

**Casos de aceptación:**
1. Un administrador crea cliente y engagement; segundo usuario con permisos los consulta.
2. Usuario sin permiso recibe denegación; tenant externo recibe denegación en todas las operaciones.
3. Se registra y lee evidencia real de Business Launch 360; evidencia vacía no cuenta como verificada.
4. Una operación duplicada no genera duplicados ni efectos externos.
5. Se exporta informe de prueba con identidad del tenant correcta (solo si el export está implementado y certificado).
6. Se audita evento, revocación y eliminación de acceso sin pérdida de datos de otros clientes.

**Métricas:** tasa de tareas críticas completadas = tareas aprobadas / tareas intentadas; tiempo ahorrado medido frente a línea base; errores críticos por ejecución; incidentes de aislamiento = 0; satisfacción cualitativa; disposición real a pagar (entrevista). Sin líneas base, marcar «sin datos», no «0%».

**Cierre piloto:** acta con resultados observables y decisiones (continuar/corregir/no lanzar). Si falla un P0: detener uso real, preservar evidencia y abrir remediación.

## 5. Embudo comercial de validación (objetivos, NO resultados)
- **Semanas 1–2:** 20 entrevistas exploratorias a despachos/PYMES (sin ofrecer producto no certificado). Registrar problema, coste actual, software utilizado, autorización de seguimiento.
- **Semanas 3–4, si P0 green:** 5 demostraciones privadas con datos sintéticos, 3 pilotos con consentimiento, sin cobrar hasta gate de facturación.
- **Meta posterior:** 1–3 conversiones pagadas medidas; no estimar MRR como ingreso existente.
- Registrar cada contacto/deal consentido en **HubSpot** una vez completada su incorporación inicial y aprobadas las mutaciones. No duplicar el CRM de ATLAS ni cargar listas privadas sin base legal.

**Definiciones KPI:** leads consentidos, entrevistas completadas, demos realizadas, pilotos iniciados, pilotos que pasan pruebas, compradores reales y MRR cobrado. Denominadores expresos: entrevistas/leads; demos/entrevistas; pilotos/demos; pagos/pilotos. Acompañar fuente, fecha y propietario en cada indicador.

**Guion de descubrimiento:** «¿Cuál es el proceso que más tiempo les cuesta: alta de clientes, seguimiento de tareas, cuentas por cobrar o reportes? ¿Cuántos casos manejan al mes? ¿Qué herramientas usan hoy? ¿Qué tendría que demostrar un piloto para justificar una suscripción?»

**Texto de contacto — para revisión, NO enviado:**
> Hola, estamos validando ATLAS, una solución para organizar clientes y operaciones de despachos pequeños. ¿Te interesaría una conversación de 15 minutos sobre tus principales obstáculos de gestión? Por ahora es una investigación de necesidades, no una oferta de funciones aún no certificadas.

## 6. Checklist empresarial / compliance
- **Confirmado:** Florida LLC ACTIVE. Guardar constancia y seguir el calendario de reportes anuales de Sunbiz; no compartir domicilio personal en materiales de marketing.
- **Pendiente de titular:** comprobar si ya existe EIN; si no, aplicar **gratis** en IRS con los datos confidenciales del responsable, sin introducir SSN/ITIN en repositorios, chats, logs ni PR.
- **Pendiente:** cuenta bancaria comercial, contabilidad segregada, beneficiario/obligaciones federales aplicables, licencia local según actividad y ubicación, seguro adecuado, términos de servicio, política de privacidad/DPA, SLA y protocolo de incidentes. Validar requisitos con profesionales cuando corresponda.
- **Florida taxes:** verificar con FL DOR si el producto/servicio específico está sujeto a sales and use tax antes de registrar o cobrar; no afirmar gravabilidad genérica de todo SaaS.
- **No se ejecuta:** solicitud EIN, formularios fiscales, apertura de cuenta, cobro, contratos, campañas, mensajes a terceros ni cambios de permisos.

## 7. Secuencia de trabajo con responsables y gates
| Etapa | Salida requerida | Gate |
|---|---|---|
| A. Seguridad | P0-01..P0-05 negativos + permisos/RLS y pruebas green | Sin datos reales hasta green |
| B. Build | Typecheck corregido en PR correspondiente; suite CI por SHA | No merge con red |
| C. Release | Cloudflare exact-SHA, HTTP/health/E2E y auditoría | No publicar «operativo» sin evidencia |
| D. Comercial | Demo sintética, 1-pager, términos/precios reconciliados | No pagos ni promesas sin gate |
| E. Piloto | Acta firmada + métricas con fuentes | No uso real si P0 abierto |
| F. Negocio | EIN/registro fiscal/banco/contratos verificados | No facturar sin setup suficiente |

## 8. Límites de esta entrega
Este documento prepara un único plan de comercialización y no corrige el código ni certifica ventas/producción. No modifica base de datos, proveedores, roles, CRM, clientes, precios, secretos ni releases. El PR debe seguir **draft / no-merge** hasta que tenga checks del HEAD y revisión apropiada. No considerar la creación del documento evidencia de implementación del producto.
