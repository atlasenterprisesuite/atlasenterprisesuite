const groups = [
 ['Universo','Big Bang y radiación cósmica','Materia, energía y partículas','Materia y energía oscuras','Primeros átomos y elementos','Primeras estrellas y galaxias','Agujeros negros'],
 ['Sistema solar','Origen del Sol','Discos protoplanetarios','Meteoritos y datación','Formación de planetas','Asteroides y cometas','Formación de la Luna'],
 ['Geología','Núcleo, manto y corteza','Primeras rocas','Agua y océanos','Atmósfera','Placas tectónicas','Volcanes y terremotos','Supercontinentes','Geología por países'],
 ['Vida','Química prebiótica','Primeras evidencias de vida','Microorganismos','ADN y ARN','Gran Oxidación','Multicelularidad','Especies marinas y terrestres','Extinciones','Especies actuales'],
 ['Humanidad','Homininos','Género Homo','Homo sapiens','Migraciones','Lenguaje','Agricultura','Sociedades'],
 ['Civilizaciones','Mesopotamia','Egipto','Valle del Indo','China','Grecia y Roma','África','América precolombina','Indonesia','Religiones y escrituras'],
 ['Historia mundial','Reinos','Comercio','Religiones','Conflictos y territorios','Países modernos','Leyes y monedas','Revoluciones científicas','Historia contemporánea'],
 ['Otros mundos','Mercurio y Venus','Marte','Júpiter y Saturno','Urano y Neptuno','Lunas','Planetas enanos','Exoplanetas','Vida extraterrestre'],
 ['Presente y futuro','Ambiente','Recursos y agua','Tecnología','IA y robótica','Economía','Exploración espacial','Escenarios futuros'],
 ['Integración','Cronologías','Contradicciones','Vacíos','Procedencia visual','Mapas','Explorador temporal','Auditoría']
];
export const modules = groups.map(([name,...titles],i)=>({id:String(i+1).padStart(2,'0'),name,topics:titles.map((title,j)=>({id:String(i+1).padStart(2,'0')+'.'+String(j+1).padStart(3,'0'),title,module:name}))}));
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const searchTopics=(q:string)=> {
 const terms=normalize(q).split(/\s+/).filter(Boolean);
 return modules.flatMap(m=>m.topics).filter(t=>terms.every(term=>normalize(t.id+' '+t.title+' '+t.module).includes(term)));
};
export function resolveChronosRoute(pathname:string):string|null {
 const path=pathname.replace(/\/$/,'');
 if(path === '/chronos') return '';
 if(!path.startsWith('/chronos/')) return null;
 const route=path.slice('/chronos/'.length);
 if(['explore','research','evidence','timeline','review'].includes(route)) return route;
 const match=/^research\/(\d{2}\.\d{3})$/.exec(route);
 return match && modules.some(m=>m.topics.some(t=>t.id===match[1])) ? route : null;
}
export const progress=()=>({total:modules.reduce((n,m)=>n+m.topics.length,0),certified:0});
export type ChronosEvidenceKind = 'archive' | 'publication';
export type ChronosEvidence = {
 id: string;
 title: string;
 url: string;
 detail: string;
 kind: ChronosEvidenceKind;
 institution: string;
 topicId: string;
 classification: 'E02';
 reviewStatus: 'pending';
};
// E02 identifies a DOCUMENTARY REFERENCE, not an independently verified finding.
// No source is marked reviewed until the underlying scientific work is audited.
export const evidence: ChronosEvidence[] = [
 {id:'CHR-EV-001',title:'COBE / FIRAS',url:'https://lambda.gsfc.nasa.gov/data/interfaces/cobe/firas_products.html',detail:'Productos instrumentales FIRAS disponibles para investigación',kind:'archive',institution:'NASA LAMBDA',topicId:'01.001',classification:'E02',reviewStatus:'pending'},
 {id:'CHR-EV-002',title:'WMAP',url:'https://lambda.gsfc.nasa.gov/product/wmap/',detail:'Archivo de observaciones cosmológicas WMAP',kind:'archive',institution:'NASA LAMBDA',topicId:'01.001',classification:'E02',reviewStatus:'pending'},
 {id:'CHR-EV-003',title:'Planck',url:'https://pla.esac.esa.int/pla/',detail:'Archivo científico de la misión Planck',kind:'archive',institution:'ESA',topicId:'01.001',classification:'E02',reviewStatus:'pending'},
 {id:'CHR-EV-004',title:'Penzias y Wilson (1965)',url:'https://doi.org/10.1086/148307',detail:'Publicación original sobre exceso de temperatura de antena',kind:'publication',institution:'The Astrophysical Journal',topicId:'01.001',classification:'E02',reviewStatus:'pending'},
 {id:'CHR-EV-005',title:'Planck 2018',url:'https://doi.org/10.1051/0004-6361/201833910',detail:'Parámetros cosmológicos publicados por la colaboración Planck',kind:'publication',institution:'Astronomy & Astrophysics',topicId:'01.001',classification:'E02',reviewStatus:'pending'}
];
export const filterEvidence = (kind: ChronosEvidenceKind | 'all', query = ''): ChronosEvidence[] => {
 const terms = normalize(query).split(/\s+/).filter(Boolean);
 return evidence.filter(source => (kind === 'all' || source.kind === kind)
  && terms.every(term => normalize([source.id,source.title,source.detail,source.institution,source.topicId].join(' ')).includes(term)));
};
export const tasks=['Identificar evidencias fundamentales','Localizar publicación original','Comparar COBE, WMAP y Planck','Contrastar parámetros publicados','Cronología y vacíos','Reprocesar archivos instrumentales','Auditar imágenes y referencias','Verificar expediente definitivo'].map(title=>({title,done:false}));
export const timeline=[['Hace ~13.800 Ma','Universo temprano'],['~380.000 años después del Big Bang','Radiación cósmica'],['4.567 Ma','Primeros sólidos solares'],['4.540 Ma','Formación terrestre'],['4.404 Ma','Circones de Jack Hills'],['3.500 Ma','Evidencia temprana de vida'],['2026 d. C.','Actualidad']];
