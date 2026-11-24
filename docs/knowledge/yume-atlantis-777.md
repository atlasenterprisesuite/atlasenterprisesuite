# Knowledge Atlas — YUME × Atlántida (ATLAS 777 REVIEW)

**Estado:** catálogo editorial versionado en código; PR pendiente de revisión y CI. **No es una ingesta de memoria aprobada ni un despliegue.**

**Propietario:** Knowledge Atlas, dominio cultura/filosofía/música.  
**Fecha del corte:** 2026-11-23 · RUN 001.  
**Origen:** investigación conversacional YUME / Platón / Alan Walker y fichero de relaciones generado anteriormente.
**SHA-256 del JSON fuente original:** `c0e4f58ac1dfd37a1d8d8f3633f551905cb51d972789b98e63b17d5fe0d2b5c7`.

## Integración existente y reutilizada

- Ruta autenticada: `/knowledge/research/yume-atlantis`, registrada en `resolveAtlasExtension` con `RequireAtlasIdentity`.
- Acceso desde la página principal `/knowledge` (no aparece en ámbitos específicos como People Knowledge).
- Página React nativa dentro de `apps/web/src/modules/knowledge/research`, usando componentes y clases visuales existentes.
- Grafo editorial tipado e inmutable en la compilación: **50 nodos / 61 aristas / 16 referencias**, con búsquedas, filtros por dominio y estado de evidencia, navegación por relaciones y fuentes enlazadas.
- Sin tablas, Edge Functions, claves, llamadas a proveedores ni almacenamiento adicional. No se escriben registros de usuarios, conversaciones ni `atlas_memory_records`; la aprobación de memoria sigue siendo un acto RBAC independiente.

## Semántica de evidencia

| Código | Significado | Interpretación correcta |
|---|---|---|
| `documentado` | Fuente atribuida en el estudio | No prueba intención artística universal, ni certifica cada afirmación |
| `relato_antiguo` | El vínculo existe dentro del texto de Platón | No confirma la existencia arqueológica de Atlántida |
| `simbolico` | Lectura comparativa razonada | No es una declaración del compositor ni hallazgo histórico |
| `pendiente` | Hipótesis de espectadores o registro no cotejado | No elevar a conocimiento verificado |

Las **16 referencias** se conservan para trazabilidad. Se marcaron como **needs_review** las referencias `S08`, `S09`, `S12`, `S14`, `S15` y `S16`, debido a enlaces con aparente marcador, espejo, fuente secundaria, recurso audiovisual no cotejado u otro problema de verificación. El visor las muestra sin enlazarlas hasta verificar. Esta cautela **no** afirma que las publicaciones no existan. Las demás son referencias atribuibles, no auditadas independientemente en este cambio.

## Control de calidad ATLAS 777

- P0: sin fugas entre organizaciones; la ruta reutiliza identidad ATLAS existente.
- P0: no clasificar material de conversaciones como memoria institucional aprobada.
- P0: integridad referencial del grafo (IDs únicos, nodos/aristas válidos, fuentes presentes, clases permitidas).
- P0: interacciones de búsqueda, navegación y filtros con controles accesibles.
- P1: contrastar URLs y declaraciones de autor con fuentes primarias actuales.
- P1: inspeccionar el videoclip y asociar fotogramas con evidencias visuales exactas y derechos/atribuciones.
- P1: ampliar cronologías y grafos con registros más antiguos o contradictorios sin perder procedencia.

## Verificación y puntos de control

Pruebas: `tests/integration/yume-atlantis-knowledge.test.tsx` (5 casos).  
Comandos pendientes de CI del SHA final: `npm ci`, `npm run typecheck`, `npm run test:integration`, `npm run build`.  
Verificación E2E pendiente de la ruta autenticada, estados móvil/escritorio, enlaces externos e integridad del despliegue.

**Decisión:** NO-GO para declaración de producción hasta aprobar CI, revisión, merge, despliegue y E2E exact-SHA. El contenido de este PR es una integración de código, no una certificación de verdad histórica.
