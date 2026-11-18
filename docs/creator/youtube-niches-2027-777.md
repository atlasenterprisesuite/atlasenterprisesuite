# ATLAS YouTube 777 — exploración editorial de nichos (2027)

## Fuente y alcance
- Fuente pública: https://www.youtube.com/watch?v=FG89iOZOG4I
- Video: Encontré Los UNICOS 10 NICHOS que Te Harán Ganar el Próximo 2027.
- Publicado: 2026-11-12, canal David Albarrán. Duración: 15:16.
- Procedencia: transcripción consultada el 2026-11-17. Tiempos aproximados, no capítulos oficiales.
- Los canales, vistas, suscriptores, horas, RPM e ingresos citados por el autor NO constituyen métricas confirmadas por ATLAS. Algunos números verbales de monetización son internamente inconsistentes y requieren verificación adicional.

## Nichos del video y enfoque original de ATLAS

| Momento | Nicho | Enfoque independiente |
|---|---|---|
| 00:30 | Historias reales ilustradas | Documentos históricos contrastados e ilustración señalizada |
| 01:32 | Vidas alternativas en videojuegos | Análisis hipotético original de narrativa y decisiones |
| 02:45 | Cuerpo humano | Divulgación científica no gráfica con fuentes |
| 03:45 | Animales extraordinarios del océano | Oceanografía; separar mito y observación |
| 05:05 | Fauna prehistórica | Paleontología y reconstrucciones identificadas |
| 06:50 | Gatos | Comportamiento y bienestar con fuentes fiables |
| 08:00 | Jesús y religión | Historia de textos, tradiciones y evidencia |
| 09:04 | Reflexiones ilustradas | Historias originales sobre valores y diálogo |
| 09:30 | Historia militar | Contexto histórico y consecuencias sin imágenes gráficas |
| 11:12 | Marcas y empresas | Casos empresariales con informes públicos |

Al final, el autor prioriza religión/Jesús, cuerpo humano y fauna prehistórica. Eso es su preferencia, no prueba de éxito para ATLAS.

## Integración sin duplicaciones

Ruta existente: /studio/content. Panel: YouTubeNicheResearchPanel. Dominio: packages/creator/youtube_niches_2027.ts.
No se crea otro producto ni otra tabla.

1. Búsqueda local real entre diez temas y selección accesible.
2. Detalles del nicho, episodio original, riesgos y vínculo al instante del video.
3. Acción «Usar este nicho» para abrir un borrador nuevo en el workspace de Creator, en español y con YouTube como plataforma prioritaria. La opción ya existente «Save workspace» guarda a través de la API autenticada existente y su control por organización.
4. Reutilización del pipeline Audience -> Ideas -> Hooks -> Content Builder -> Repurpose -> Review.
5. Cinco controles locales de evidencia. Si falta uno, NO_GO; con todos marcados, REVIEW_REQUIRED. Estas casillas no equivalen a validación en servidor ni habilitan publicación.
6. No hay claves, OAuth, proveedores pagados, publicación automática ni métricas de rendimiento artificiales.

## Estrategia de contenido propuesta, no publicada

Probar series coherentes sobre (a) océanos y paleontología; (b) historia de textos documentados; (c) tecnología, videojuegos y empresas. No mezclar diez públicos sin validar la audiencia. Para cada piloto: investigar -> guion original -> comprobar derechos -> editar -> revisar -> publicar con permisos -> medir resultados de Analytics.

## Seguridad, derechos y monetización

Originalidad: https://support.google.com/youtube/answer/1311392
Política contra spam y automatización abusiva: https://support.google.com/youtube/answer/2801973
Métricas oficiales: https://support.google.com/youtube/answer/12220281
Elegibilidad YPP: https://support.google.com/youtube/answer/72851

No reutilizar videos ajenos sin licencia ni generar producciones repetitivas sin valor propio. Las promesas de ganancias del video deben tratarse como hipótesis de terceros.

## Estado de aceptación
- [x] Reutilización de módulos existentes y fuente identificada.
- [x] Pruebas de contrato añadidas antes del dominio de producción.
- [ ] Pruebas completas y typecheck verificados contra SHA.
- [ ] Seguridad, WCAG, RBAC y E2E comprobados.
- [ ] CI, revisión de PR, merge, despliegue y producción exact-SHA verificados.

Estado: P0 NO_GO hasta contar con evidencia completa. No se ha subido ni monetizado ningún video.
