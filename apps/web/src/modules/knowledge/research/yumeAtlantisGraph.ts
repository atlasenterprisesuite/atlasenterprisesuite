/**
 * ATLAS Knowledge / YUME x Atlantis — editorial research catalog (RUN 001).
 * Imported from the 2026-11-23 research snapshot, not from tenant memory.
 * "documentado" is source-attributed, not independent scientific certification.
 * No lyrics or protected audiovisual assets are embedded.
 */
export type YumeEvidenceKind = 'documentado' | 'relato_antiguo' | 'simbolico' | 'pendiente';
export type YumeKnowledgeNode = { id: string; label: string; group: string; description: string; source_ids: string[] };
export type YumeKnowledgeEdge = { source: string; target: string; type: YumeEvidenceKind; reason: string; source_ids: string[] };
export type YumeKnowledgeSource = { label: string; url: string };
export type YumeKnowledgeGraph = {
  title: string; created_on: string; state: string; methodology: Record<YumeEvidenceKind, string>;
  sources: Record<string, YumeKnowledgeSource>; nodes: YumeKnowledgeNode[]; edges: YumeKnowledgeEdge[];
};

// Preserve the complete source graph, including unreviewed references for auditability.
export const YUME_ATLANTIS_GRAPH: YumeKnowledgeGraph = {
  "title": "ATLAS 777 REVIEW — Red de conexiones YUME / Atlántida",
  "created_on": "2026-11-23",
  "state": "Investigación y representación documental; NO hay despliegue a producción",
  "methodology": {
    "documentado": "Respaldado por fuente primaria o reporte específico.",
    "relato_antiguo": "Verdadero dentro del texto de Platón, no una confirmación arqueológica.",
    "simbolico": "Interpretación contextual explicitamente no documentada como intención autoral.",
    "pendiente": "Propuesta o pista sin cotejo visual/confirmación."
  },
  "sources": {
    "S01": {
      "label": "Platón — Timeo (MIT Classics)",
      "url": "https://classics.mit.edu/Plato/timaeus.html"
    },
    "S02": {
      "label": "Platón — Critias (MIT Classics)",
      "url": "https://classics.mit.edu/Plato/critias.html"
    },
    "S03": {
      "label": "Cirque du Soleil — Comunicado YUME (20/11/2026)",
      "url": "https://www.cirquedusoleil.com/press/news/2026/alan-walker-raul-new-single-inspired-by-cirque-du-soleil"
    },
    "S04": {
      "label": "AVEX — Comunicado YUME (21/11/2026)",
      "url": "https://avexnet.jp/news/1038455"
    },
    "S05": {
      "label": "AVEX — anuncio de la colaboración (09/11/2026)",
      "url": "https://www.avexnet.jp/news/1038137"
    },
    "S06": {
      "label": "UTA-Net — créditos y letra de YUME",
      "url": "https://www.uta-net.com/song/402535/"
    },
    "S07": {
      "label": "Fuji TV — programa FNS 2026",
      "url": "https://www.fujitv.co.jp/FNS/"
    },
    "S08": {
      "label": "AVEX / Snow Man — YUME en FNS (19/11/2026)",
      "url": "https://img.avexnet.jp/contents/SNOMN-XXXX-XXXX/news/1137371"
    },
    "S09": {
      "label": "YouTube for Artists — We Are Walkers",
      "url": "https://artists.youtube/news/alan-walker-we-are-walkers/"
    },
    "S10": {
      "label": "Treccani — saltimbanco (etimología)",
      "url": "https://www.treccani.it/vocabolario/saltimbanco/"
    },
    "S11": {
      "label": "Cirque du Soleil — preguntas de casting (Grommelot)",
      "url": "https://casting.cirquedusoleil.com/faq"
    },
    "S12": {
      "label": "Transcripción pública de la publicación de Alan Walker (20/11/2026)",
      "url": "https://www.nitter.cf/IAmAlanWalker/status/2123787667754426832"
    },
    "S13": {
      "label": "Stanford Encyclopedia of Philosophy — mitos de Platón",
      "url": "https://plato.stanford.edu/archives/fall2024/entries/plato-myths/"
    },
    "S14": {
      "label": "Vídeo oficial YUME (Alan Walker)",
      "url": "https://www.youtube.com/watch?v=xpRB5Huqe9Y"
    },
    "S15": {
      "label": "Musicnotes — Pokinoï / Cirquish",
      "url": "https://www.musicnotes.com/sheetmusic/cirque-du-soleil/pokino%C3%AF/MN0059483"
    },
    "S16": {
      "label": "Kazi Magazine — reseña audiovisual del videoclip (22/11/2026)",
      "url": "https://kazimagazine.com/news/alan-walker-raul-yume"
    }
  },
  "nodes": [
    {
      "id": "plato",
      "label": "Platón",
      "group": "Antigüedad",
      "description": "Filósofo griego que presenta Atlántida en sus diálogos.",
      "source_ids": [
        "S01",
        "S02",
        "S13"
      ]
    },
    {
      "id": "timaeus",
      "label": "Timeo",
      "group": "Antigüedad",
      "description": "Incluye la narración transmitida por Solón, la ubicación más allá de las Columnas de Hércules y la catástrofe.",
      "source_ids": [
        "S01"
      ]
    },
    {
      "id": "critias",
      "label": "Critias",
      "group": "Antigüedad",
      "description": "Detalla genealogía, trazado de la isla, gobierno, metal oricalco y cultos.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "solon",
      "label": "Solón",
      "group": "Antigüedad",
      "description": "Legislador de Atenas que figura dentro de la cadena narrativa de transmisión del relato.",
      "source_ids": [
        "S01"
      ]
    },
    {
      "id": "egypt",
      "label": "Sacerdotes egipcios",
      "group": "Antigüedad",
      "description": "Narradores del pasado remoto en la estructura literaria del Timeo; no archivo contemporáneo comprobado.",
      "source_ids": [
        "S01"
      ]
    },
    {
      "id": "atlantis",
      "label": "Atlántida (Platón)",
      "group": "Antigüedad",
      "description": "Isla y potencia marítima de una narración filosófica. No corresponde a una ciudad arqueológicamente identificada.",
      "source_ids": [
        "S01",
        "S02",
        "S13"
      ]
    },
    {
      "id": "heracles",
      "label": "Columnas de Hércules",
      "group": "Antigüedad",
      "description": "Referencia geográfica del relato asociada al entorno del estrecho de Gibraltar.",
      "source_ids": [
        "S01"
      ]
    },
    {
      "id": "poseidon",
      "label": "Poseidón",
      "group": "Antigüedad",
      "description": "Dios del mar y progenitor de la dinastía atlante en la ficción de Critias.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "cleito",
      "label": "Clito / Cleito",
      "group": "Antigüedad",
      "description": "Mujer mortal, pareja de Poseidón y madre de cinco pares de gemelos.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "atlas_king",
      "label": "Atlas, primer rey",
      "group": "Antigüedad",
      "description": "Primogénito de Poseidón y Clito. En el relato, su nombre da origen a Atlántida.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "ten_kings",
      "label": "Diez príncipes",
      "group": "Antigüedad",
      "description": "Cinco pares de gemelos y diez divisiones del reino; no implica un código numérico demostrado.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "rings",
      "label": "Anillos de tierra y agua",
      "group": "Antigüedad",
      "description": "Dos anillos de tierra y tres de agua rodean el centro según Critias.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "orichalcum",
      "label": "Oricalco",
      "group": "Antigüedad",
      "description": "Metal valioso mencionado por Platón, aplicado a templos y a una columna con leyes.",
      "source_ids": [
        "S02"
      ]
    },
    {
      "id": "loss_records",
      "label": "Pérdida de registros",
      "group": "Antigüedad",
      "description": "El relato compara grandes cataclismos con el olvido de acontecimientos remotos.",
      "source_ids": [
        "S01"
      ]
    },
    {
      "id": "flood",
      "label": "Destrucción por inundaciones",
      "group": "Antigüedad",
      "description": "Terremotos e inundaciones causan el hundimiento de Atlántida dentro del relato.",
      "source_ids": [
        "S01"
      ]
    },
    {
      "id": "cirque",
      "label": "Cirque du Soleil",
      "group": "Música 1992",
      "description": "Compañía escénica canadiense que produjo Saltimbanco.",
      "source_ids": [
        "S03"
      ]
    },
    {
      "id": "saltimbanco",
      "label": "Saltimbanco (1992)",
      "group": "Música 1992",
      "description": "Espectáculo estrenado en 1992 con música de René Dupéré.",
      "source_ids": [
        "S03"
      ]
    },
    {
      "id": "salt_word",
      "label": "Saltimbanco (palabra)",
      "group": "Música 1992",
      "description": "En italiano, acróbata o saltimbanqui; etimológicamente saltar sobre bancos.",
      "source_ids": [
        "S10"
      ]
    },
    {
      "id": "rene",
      "label": "René Dupéré",
      "group": "Música 1992",
      "description": "Compositor de Pokinoi, reimaginada musicalmente en YUME.",
      "source_ids": [
        "S03"
      ]
    },
    {
      "id": "pokinoi",
      "label": "Pokinoï / Pokinoi",
      "group": "Música 1992",
      "description": "Composición del espectáculo Saltimbanco que sirve de base musical a YUME.",
      "source_ids": [
        "S03",
        "S15"
      ]
    },
    {
      "id": "cirquish",
      "label": "Lenguas escénicas inventadas",
      "group": "Música 1992",
      "description": "Pokinoï se describe como cantada en Cirquish; por separado, Cirque usa el nombre Grommelot para muchas piezas de sus kits de casting. No se debe asumir equivalencia total.",
      "source_ids": [
        "S11",
        "S15"
      ]
    },
    {
      "id": "alan",
      "label": "Alan Walker",
      "group": "Música 2026",
      "description": "Productor y DJ, cocreador de YUME y del universo World of Walker.",
      "source_ids": [
        "S03",
        "S04"
      ]
    },
    {
      "id": "raul",
      "label": "Raul",
      "group": "Música 2026",
      "description": "Vocalista y bailarín japonés integrante de Snow Man; colaborador en YUME.",
      "source_ids": [
        "S04",
        "S05"
      ]
    },
    {
      "id": "snow",
      "label": "Snow Man",
      "group": "Música 2026",
      "description": "Grupo japonés del que forma parte Raul.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "yume",
      "label": "YUME (2026)",
      "group": "Música 2026",
      "description": "Canción estrenada el 20 de noviembre de 2026; combina una base de Pokinoi con una narración sobre los sueños.",
      "source_ids": [
        "S03",
        "S04",
        "S06"
      ]
    },
    {
      "id": "e1",
      "label": "Eleanora",
      "group": "Música 2026",
      "description": "Personaje nombrado en la letra. No se ha comprobado aquí que sea una identidad concreta del videoclip.",
      "source_ids": [
        "S06"
      ]
    },
    {
      "id": "dream_jp",
      "label": "夢は消えない",
      "group": "Música 2026",
      "description": "Yume wa kienai: «el sueño no desaparece», idea principal confirmada por AVEX.",
      "source_ids": [
        "S04",
        "S06"
      ]
    },
    {
      "id": "fate",
      "label": "Fate (2026)",
      "group": "Música 2026",
      "description": "Colaboración de Alan Walker con Ava Max que abrió el capítulo Legends of Atlantis en junio.",
      "source_ids": [
        "S04",
        "S05"
      ]
    },
    {
      "id": "ava",
      "label": "Ava Max",
      "group": "Música 2026",
      "description": "Cantante que colaboró en Fate.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "legends",
      "label": "Legends of Atlantis",
      "group": "Música 2026",
      "description": "Capítulo ficcional del universo de Alan Walker que incluye Fate y el videoclip de YUME.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "walkerworld",
      "label": "World of Walker",
      "group": "Música 2026",
      "description": "Universo narrativo y musical extendido a experiencias interactivas.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "drones",
      "label": "Rise of the Drones",
      "group": "Música 2026",
      "description": "Etapa narrativa anterior del mundo de Walker vinculada a tecnología y juego.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "logo",
      "label": "Monograma AW",
      "group": "Símbolos",
      "description": "Identidad gráfica del artista. Por sí solo no indica un alfabeto antiguo.",
      "source_ids": [
        "S09"
      ]
    },
    {
      "id": "mask",
      "label": "Máscaras y capuchas",
      "group": "Símbolos",
      "description": "Walker ha descrito la máscara como símbolo de pertenencia y unidad.",
      "source_ids": [
        "S09"
      ]
    },
    {
      "id": "tide",
      "label": "Marea",
      "group": "Símbolos",
      "description": "Metáfora de cambio y desaparición en la narración de la letra.",
      "source_ids": [
        "S06"
      ]
    },
    {
      "id": "moon",
      "label": "Luna",
      "group": "Símbolos",
      "description": "Imagen literaria de distancia y recorrido en la letra; su atracción gravitatoria está vinculada a mareas.",
      "source_ids": [
        "S06"
      ]
    },
    {
      "id": "memory",
      "label": "Memoria y regreso",
      "group": "Símbolos",
      "description": "La narración explora recuerdos y la búsqueda del pasado.",
      "source_ids": [
        "S06"
      ]
    },
    {
      "id": "lights",
      "label": "Luces cegadoras",
      "group": "Símbolos",
      "description": "Imagen de temor o exposición dentro de la letra.",
      "source_ids": [
        "S06"
      ]
    },
    {
      "id": "fire",
      "label": "Fuego",
      "group": "Símbolos",
      "description": "Se usa la expresión idiomática inglesa que significa asumir riesgos.",
      "source_ids": [
        "S06"
      ]
    },
    {
      "id": "red_gold",
      "label": "Rojo y dorado",
      "group": "Símbolos",
      "description": "Colores descritos en la vestimenta y ambientación; las lecturas de poder o intensidad son interpretativas.",
      "source_ids": [
        "S16"
      ]
    },
    {
      "id": "ruins",
      "label": "Ruinas de piedra",
      "group": "Símbolos",
      "description": "Escenografía descrita en la reseña del video, compatible estéticamente con un mundo perdido.",
      "source_ids": [
        "S16"
      ]
    },
    {
      "id": "oslo",
      "label": "Oslo, Noruega",
      "group": "Producción",
      "description": "Ciudad donde AVEX indica que se rodó el videoclip.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "vfx",
      "label": "3DCG y VFX",
      "group": "Producción",
      "description": "Técnicas digitales empleadas para construir los ambientes del videoclip.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "musicstation",
      "label": "Music Station",
      "group": "Difusión",
      "description": "Programa de televisión japonés donde se estrenó en TV la colaboración el 20 de noviembre.",
      "source_ids": [
        "S04"
      ]
    },
    {
      "id": "fns",
      "label": "FNS Kayōsai",
      "group": "Difusión",
      "description": "Festival musical televisado de Fuji TV que anunció YUME para la primera noche del 2 de diciembre.",
      "source_ids": [
        "S07",
        "S08"
      ]
    },
    {
      "id": "fujitv",
      "label": "Fuji Television",
      "group": "Difusión",
      "description": "Cadena japonesa que transmite FNS Kayōsai.",
      "source_ids": [
        "S07"
      ]
    },
    {
      "id": "objecthunt",
      "label": "Búsqueda del objeto oculto",
      "group": "Pendiente",
      "description": "Publicación atribuida a Alan Walker plantea identificar un objeto y marcar el segundo; no se verificó solución oficial.",
      "source_ids": [
        "S12"
      ]
    },
    {
      "id": "redobj",
      "label": "Objeto rojo 00:21",
      "group": "Pendiente",
      "description": "Identificación propuesta por seguidores; la lectura como piedra filosofal no está confirmada.",
      "source_ids": [
        "S12"
      ]
    },
    {
      "id": "books",
      "label": "Libros 01:54",
      "group": "Pendiente",
      "description": "Una respuesta de seguidor propone libros; no hay confirmación aquí de contenido ni símbolo.",
      "source_ids": [
        "S12"
      ]
    },
    {
      "id": "waffles",
      "label": "Gofres 03:11",
      "group": "Pendiente",
      "description": "Varios espectadores mencionan gofres noruegos; no se verificó cuál es el objeto del reto.",
      "source_ids": [
        "S12"
      ]
    }
  ],
  "edges": [
    {
      "source": "plato",
      "target": "timaeus",
      "type": "relato_antiguo",
      "reason": "Obra escrita",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "plato",
      "target": "critias",
      "type": "relato_antiguo",
      "reason": "Obra escrita",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "timaeus",
      "target": "atlantis",
      "type": "relato_antiguo",
      "reason": "Narración original",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "critias",
      "target": "atlantis",
      "type": "relato_antiguo",
      "reason": "Descripción detallada",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "timaeus",
      "target": "solon",
      "type": "relato_antiguo",
      "reason": "Cadena narrativa",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "solon",
      "target": "egypt",
      "type": "relato_antiguo",
      "reason": "Transmisión dentro del relato",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "atlantis",
      "target": "heracles",
      "type": "relato_antiguo",
      "reason": "Situación narrada",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "poseidon",
      "target": "cleito",
      "type": "relato_antiguo",
      "reason": "Progenitores en el relato",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "poseidon",
      "target": "atlas_king",
      "type": "relato_antiguo",
      "reason": "Padre según Critias",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "cleito",
      "target": "atlas_king",
      "type": "relato_antiguo",
      "reason": "Madre según Critias",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "atlas_king",
      "target": "ten_kings",
      "type": "relato_antiguo",
      "reason": "Primer rey entre diez príncipes",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "atlantis",
      "target": "ten_kings",
      "type": "relato_antiguo",
      "reason": "Diez distritos de gobierno",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "atlantis",
      "target": "rings",
      "type": "relato_antiguo",
      "reason": "Arquitectura concéntrica",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "atlantis",
      "target": "orichalcum",
      "type": "relato_antiguo",
      "reason": "Metal descrito",
      "source_ids": [
        "S02"
      ]
    },
    {
      "source": "atlantis",
      "target": "flood",
      "type": "relato_antiguo",
      "reason": "Desaparición narrada",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "egypt",
      "target": "loss_records",
      "type": "relato_antiguo",
      "reason": "Memoria de catástrofes en el relato",
      "source_ids": [
        "S01"
      ]
    },
    {
      "source": "cirque",
      "target": "saltimbanco",
      "type": "documentado",
      "reason": "Compañía creadora",
      "source_ids": [
        "S03"
      ]
    },
    {
      "source": "saltimbanco",
      "target": "rene",
      "type": "documentado",
      "reason": "Música original",
      "source_ids": [
        "S03"
      ]
    },
    {
      "source": "rene",
      "target": "pokinoi",
      "type": "documentado",
      "reason": "Compositor",
      "source_ids": [
        "S03"
      ]
    },
    {
      "source": "saltimbanco",
      "target": "pokinoi",
      "type": "documentado",
      "reason": "Tema musical del espectáculo",
      "source_ids": [
        "S03"
      ]
    },
    {
      "source": "saltimbanco",
      "target": "salt_word",
      "type": "documentado",
      "reason": "Título con origen italiano",
      "source_ids": [
        "S10"
      ]
    },
    {
      "source": "pokinoi",
      "target": "cirquish",
      "type": "documentado",
      "reason": "Letra en lenguaje ficticio según partitura",
      "source_ids": [
        "S15"
      ]
    },
    {
      "source": "pokinoi",
      "target": "yume",
      "type": "documentado",
      "reason": "Punto de partida musical confirmado",
      "source_ids": [
        "S03"
      ]
    },
    {
      "source": "alan",
      "target": "yume",
      "type": "documentado",
      "reason": "Artista y compositor",
      "source_ids": [
        "S03",
        "S06"
      ]
    },
    {
      "source": "raul",
      "target": "yume",
      "type": "documentado",
      "reason": "Artista vocal invitado",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "raul",
      "target": "snow",
      "type": "documentado",
      "reason": "Integrante",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "yume",
      "target": "dream_jp",
      "type": "documentado",
      "reason": "Expresión japonesa central",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "yume",
      "target": "e1",
      "type": "documentado",
      "reason": "Personaje de la letra",
      "source_ids": [
        "S06"
      ]
    },
    {
      "source": "alan",
      "target": "fate",
      "type": "documentado",
      "reason": "Colaboración publicada",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "ava",
      "target": "fate",
      "type": "documentado",
      "reason": "Artista invitada",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "fate",
      "target": "legends",
      "type": "documentado",
      "reason": "Comienzo de capítulo",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "legends",
      "target": "yume",
      "type": "documentado",
      "reason": "Contexto de videoclip",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "walkerworld",
      "target": "legends",
      "type": "documentado",
      "reason": "Desarrollo del universo musical",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "walkerworld",
      "target": "drones",
      "type": "documentado",
      "reason": "Capítulo previo",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "alan",
      "target": "mask",
      "type": "documentado",
      "reason": "Explicación de su estética",
      "source_ids": [
        "S09"
      ]
    },
    {
      "source": "alan",
      "target": "logo",
      "type": "documentado",
      "reason": "Identidad artística",
      "source_ids": [
        "S09"
      ]
    },
    {
      "source": "yume",
      "target": "oslo",
      "type": "documentado",
      "reason": "Lugar de rodaje del videoclip",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "yume",
      "target": "vfx",
      "type": "documentado",
      "reason": "Técnicas de posproducción",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "yume",
      "target": "musicstation",
      "type": "documentado",
      "reason": "Estreno televisivo",
      "source_ids": [
        "S04"
      ]
    },
    {
      "source": "yume",
      "target": "fns",
      "type": "documentado",
      "reason": "Actuación anunciada",
      "source_ids": [
        "S08"
      ]
    },
    {
      "source": "fns",
      "target": "fujitv",
      "type": "documentado",
      "reason": "Emisor",
      "source_ids": [
        "S07"
      ]
    },
    {
      "source": "yume",
      "target": "objecthunt",
      "type": "documentado",
      "reason": "Reto público propuesto en una publicación atribuida al artista",
      "source_ids": [
        "S12"
      ]
    },
    {
      "source": "tide",
      "target": "yume",
      "type": "documentado",
      "reason": "Palabra e imagen de la letra",
      "source_ids": [
        "S06"
      ]
    },
    {
      "source": "moon",
      "target": "yume",
      "type": "documentado",
      "reason": "Imagen de la letra",
      "source_ids": [
        "S06"
      ]
    },
    {
      "source": "memory",
      "target": "yume",
      "type": "documentado",
      "reason": "Tema narrativo en la letra",
      "source_ids": [
        "S06"
      ]
    },
    {
      "source": "lights",
      "target": "yume",
      "type": "documentado",
      "reason": "Imagen de la letra",
      "source_ids": [
        "S06"
      ]
    },
    {
      "source": "fire",
      "target": "yume",
      "type": "documentado",
      "reason": "Imagen de la letra",
      "source_ids": [
        "S06"
      ]
    },
    {
      "source": "red_gold",
      "target": "ruins",
      "type": "documentado",
      "reason": "Ambiente visual reseñado",
      "source_ids": [
        "S16"
      ]
    },
    {
      "source": "atlantis",
      "target": "legends",
      "type": "simbolico",
      "reason": "Referencia nominal y temática a la Atlántida clásica",
      "source_ids": []
    },
    {
      "source": "flood",
      "target": "tide",
      "type": "simbolico",
      "reason": "Agua como agente de cambio y pérdida, fenómenos no equivalentes",
      "source_ids": []
    },
    {
      "source": "loss_records",
      "target": "memory",
      "type": "simbolico",
      "reason": "El olvido del pasado como motivo cultural compartido",
      "source_ids": []
    },
    {
      "source": "rings",
      "target": "logo",
      "type": "simbolico",
      "reason": "Ambas son geometrías, sin origen gráfico común demostrado",
      "source_ids": []
    },
    {
      "source": "orichalcum",
      "target": "red_gold",
      "type": "simbolico",
      "reason": "Metales valiosos y estética de riqueza, analogía no acreditada",
      "source_ids": []
    },
    {
      "source": "atlantis",
      "target": "ruins",
      "type": "simbolico",
      "reason": "Arquitectura de un mundo perdido como atmósfera",
      "source_ids": []
    },
    {
      "source": "dream_jp",
      "target": "memory",
      "type": "simbolico",
      "reason": "Persistencia del sueño frente a pérdida de recuerdos",
      "source_ids": []
    },
    {
      "source": "moon",
      "target": "tide",
      "type": "simbolico",
      "reason": "Vínculo natural: gravitación lunar y mareas",
      "source_ids": []
    },
    {
      "source": "fire",
      "target": "lights",
      "type": "simbolico",
      "reason": "Metáforas de peligro e intensidad",
      "source_ids": []
    },
    {
      "source": "mask",
      "target": "ten_kings",
      "type": "simbolico",
      "reason": "Pertenencia a un grupo y autoridad colectiva: analogía débil, no atribuir intención",
      "source_ids": []
    },
    {
      "source": "objecthunt",
      "target": "redobj",
      "type": "pendiente",
      "reason": "Hipótesis de espectador, sin resolución oficial",
      "source_ids": [
        "S12"
      ]
    },
    {
      "source": "objecthunt",
      "target": "books",
      "type": "pendiente",
      "reason": "Hipótesis de espectador, sin resolución oficial",
      "source_ids": [
        "S12"
      ]
    },
    {
      "source": "objecthunt",
      "target": "waffles",
      "type": "pendiente",
      "reason": "Hipótesis de espectadores, sin resolución oficial",
      "source_ids": [
        "S12"
      ]
    }
  ]
};
/** Review flags are not claims that the referenced publication does not exist. */
export const YUME_SOURCE_REVIEW: Readonly<Record<string, 'reference' | 'needs_review'>> = {
  S01: 'reference', S02: 'reference', S03: 'reference', S04: 'reference',
  S05: 'reference', S06: 'reference', S07: 'reference', S08: 'needs_review',
  S09: 'needs_review', S10: 'reference', S11: 'reference', S12: 'needs_review',
  S13: 'reference', S14: 'needs_review', S15: 'needs_review', S16: 'needs_review'
};

export function validateYumeGraph(graph: YumeKnowledgeGraph): string[] {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id)) issues.push('duplicate_or_empty_node:' + node.id);
    ids.add(node.id);
    if (!node.source_ids.length) issues.push('unsourced_node:' + node.id);
    for (const source of node.source_ids) if (!graph.sources[source]) issues.push('missing_node_source:' + source);
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) issues.push('orphan_edge:' + edge.source + ':' + edge.target);
    if (!['documentado', 'relato_antiguo', 'simbolico', 'pendiente'].includes(edge.type)) issues.push('invalid_edge_type:' + edge.type);
    if (!edge.reason.trim()) issues.push('empty_edge_reason:' + edge.source);
    if (!edge.source_ids.length) issues.push('unsourced_edge:' + edge.source + ':' + edge.target);
    for (const source of edge.source_ids) if (!graph.sources[source]) issues.push('missing_edge_source:' + source);
  }
  for (const [id, source] of Object.entries(graph.sources)) {
    if (!source.label.trim() || !source.url.startsWith('https://')) issues.push('invalid_source:' + id);
  }
  return issues;
}
