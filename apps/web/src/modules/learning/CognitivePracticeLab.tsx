import { useEffect, useRef, useState } from 'react';
import { buildDigits, buildStroop, colors, countWords, logicForms, readingForms, recallForms, reactionSummary, scoreAnswers, protocolVersion } from '../../../../../packages/learning/cognitive-practice';
import type { Color } from '../../../../../packages/learning/cognitive-practice';

const labels = ['C01 · Velocidad e inhibición','C02 · Fluidez verbal','C03 · Recuerdo de acontecimientos','C04 · Memoria de trabajo','C05 · Razonamiento','C06 · Comprensión de lectura'];
const inks: Record<Color,string> = {rojo:'#b91c1c', azul:'#1d4ed8', verde:'#166534'};
type Question = {prompt:string;options:string[];answer:number};

function Quiz({questions}:{questions:Question[]}) {
  const [answers,setAnswers] = useState<Record<number,number>>({});
  const [finished,setFinished] = useState(false);
  return <div className="page-stack">
    {questions.map((q,i)=><fieldset key={i} disabled={finished}><legend>{q.prompt}</legend>
      {q.options.map((option,j)=><label className="check-field" key={j}><input type="radio" name={'cognitive-question-'+i} checked={answers[i]===j} onChange={()=>setAnswers(old=>({...old,[i]:j}))}/><span>{option}</span></label>)}
    </fieldset>)}
    {finished ? <p role="status">Aciertos: {questions.filter((q,i)=>answers[i]===q.answer).length}/{questions.length}</p> :
      <button type="button" className="primary-button" disabled={Object.keys(answers).length!==questions.length} onClick={()=>setFinished(true)}>Evaluar respuestas</button>}
  </div>;
}

function Stroop({seed}:{seed:number}) {
  const [trials] = useState(()=>buildStroop(seed));
  const [results,setResults] = useState<{correct:boolean;ms:number}[]>([]);
  const [started,setStarted] = useState(false);
  const onset = useRef(0);
  const gate = useRef(false);
  const index = results.length;
  const trial = trials[index];
  useEffect(()=>{ if(started && trial){ onset.current=performance.now(); gate.current=true; } },[started,index,trial]);
  function answer(ink:Color) {
    if(!trial || !gate.current) return;
    gate.current=false;
    const item={correct:ink===trial.ink,ms:performance.now()-onset.current};
    setResults(old=>[...old,item]);
  }
  const score = reactionSummary(results);
  if(!started) return <div><p>Identifica el color de la tinta, no el significado de la palabra. Esta actividad depende de la percepción del color; puedes omitirla.</p><button type="button" className="primary-button" onClick={()=>setStarted(true)}>Comenzar 12 intentos</button></div>;
  if(!trial) return <div role="status"><p>Aciertos: {score.correct}/{score.total}</p><p>Mediana de respuesta correcta: {score.medianMs===null?'No disponible':Math.round(score.medianMs)+' ms'}</p><p>Medición aproximada del navegador; no es cronometraje clínico.</p></div>;
  return <div className="page-stack"><p>Intento {index+1}/{trials.length}</p><p style={{color:inks[trial.ink],background:'#fff',fontSize:'2rem',fontWeight:700,textAlign:'center',padding:'1rem'}}>{trial.word.toUpperCase()}</p>
    <div className="module-grid compact">{colors.map(c=><button type="button" className="secondary-button" key={c} onClick={()=>answer(c)}>{c}</button>)}</div></div>;
}

function Fluency({form}:{form:number}) {
  const [phase,setPhase] = useState<'ready'|'running'|'finished'>('ready');
  const [remaining,setRemaining] = useState(60);
  const [words,setWords] = useState('');
  const deadline=useRef(0);
  useEffect(()=>{
    if(phase!=='running')return;
    const tick=()=>{const left=Math.max(0,Math.ceil((deadline.current-performance.now())/1000));setRemaining(left);if(left===0)setPhase('finished');};
    const timer=window.setInterval(tick,100);
    return ()=>window.clearInterval(timer);
  },[phase]);
  const score=countWords(words);
  return <div className="page-stack"><p>Escribe nombres de {form===0?'animales':'frutas'} durante 60 segundos, separados por comas. No incluyas nombres personales.</p>
    {phase==='ready'?<button type="button" className="primary-button" onClick={()=>{deadline.current=performance.now()+60000;setPhase('running');}}>Iniciar</button>:<>
    <p>Tiempo restante: {remaining} s</p><label className="field"><span>Palabras</span><textarea value={words} disabled={phase!=='running'} onChange={e=>{if(performance.now()<deadline.current)setWords(e.target.value);}}/></label>
    {phase==='running'?<button type="button" className="secondary-button" onClick={()=>setPhase('finished')}>Terminar ahora</button>:<p role="status">Total: {score.total} · Únicas: {score.unique} · Repetidas: {score.repeated}. La validez de la categoría no se comprueba automáticamente; terminar antes del límite impide comparar tiempos.</p>}</>}
  </div>;
}

function Recall({form}:{form:number}) {
  const item=recallForms[form];
  const [stage,setStage]=useState(0);
  const [answers,setAnswers]=useState<string[]>([]);
  if(stage===0)return <div><p>Lee este relato y ocúltalo cuando estés listo.</p><p>{item.passage}</p><button type="button" className="primary-button" onClick={()=>setStage(1)}>Ocultar relato</button></div>;
  if(stage===2)return <div role="status"><p>Aciertos exactos: {scoreAnswers(answers,item.keys)}/{item.keys.length}</p><p>Claves: {item.keys.join(' · ')}.</p><p>Recuerdo inmediato con pistas; no mide retención diferida.</p></div>;
  return <div className="page-stack">{item.prompts.map((prompt,i)=><label key={prompt} className="field"><span>{prompt}</span><input value={answers[i]??''} onChange={e=>{const value=e.target.value;setAnswers(old=>{const next=[...old];next[i]=value;return next;});}}/></label>)}<button type="button" className="primary-button" onClick={()=>setStage(2)}>Evaluar recuerdo</button></div>;
}

function Digits({seed}:{seed:number}) {
  const [trials]=useState(()=>buildDigits(seed));
  const [index,setIndex]=useState(0);
  const [visible,setVisible]=useState(true);
  const [answer,setAnswer]=useState('');
  const [scores,setScores]=useState<boolean[]>([]);
  const trial=trials[index];
  if(!trial)return <p role="status">Secuencias correctas: {scores.filter(Boolean).length}/{trials.length}. Exposición autogestionada, no estandarizada.</p>;
  return <div className="page-stack"><p>Secuencia {index+1} de {trials.length} · {trial.reverse?'Orden inverso':'Orden directo'}</p>
    {visible?<><p style={{fontSize:'1.6rem',letterSpacing:'.2em'}}>{trial.digits.join(' ')}</p><button type="button" className="primary-button" onClick={()=>setVisible(false)}>Ocultar números</button></>:<>
    <label className="field"><span>Secuencia recordada</span><input value={answer} inputMode="numeric" onChange={e=>setAnswer(e.target.value)}/></label>
    <button type="button" className="primary-button" onClick={()=>{setScores(old=>[...old,answer.replace(/\s/g,'')===trial.answer]);setIndex(index+1);setVisible(true);setAnswer('');}}>Siguiente</button></>}
  </div>;
}

function Reading({form}:{form:number}) {
  const [read,setRead]=useState(false);
  const item=readingForms[form];
  return read?<Quiz questions={item.questions}/>:<div><p>{item.passage}</p><button type="button" className="primary-button" onClick={()=>setRead(true)}>Terminar lectura</button></div>;
}

export function CognitivePracticeLab(){
  const [exercise,setExercise]=useState(0);
  const [form,setForm]=useState(0);
  const [attempt,setAttempt]=useState(0);
  const [active,setActive]=useState(false);
  const seed=(form+1)*104729+attempt;
  return <section className="feature-card page-stack" id="cognitive-practice" lang="es" aria-labelledby="cognitive-title">
    <header><p className="eyebrow">ATLAS Cognitive Research 777 · {protocolVersion}</p><h2 id="cognitive-title">Laboratorio de práctica cognitiva</h2><p>Seis ejercicios educativos voluntarios. No son diagnósticos, pruebas clínicas, ni mediciones de IQ o de cambios cerebrales. Puedes detenerte en cualquier momento.</p></header>
    <p className="notice">Las respuestas permanecen en la memoria de esta página; este laboratorio no guarda ni transmite sus resultados. Las formas son originales, no calibradas y no equivalentes científicamente.</p>
    {!active?<><label className="field"><span>Ejercicio</span><select value={exercise} onChange={e=>setExercise(Number(e.target.value))}>{labels.map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label>
      <label className="field"><span>Forma de práctica</span><select value={form} onChange={e=>setForm(Number(e.target.value))}><option value={0}>A</option><option value={1}>B</option></select></label>
      <button type="button" className="primary-button" onClick={()=>{setAttempt(n=>n+1);setActive(true);}}>Abrir ejercicio</button></>:<>
      <h3>{labels[exercise]}</h3><div key={attempt}>
      {exercise===0?<Stroop seed={seed}/>:exercise===1?<Fluency form={form}/>:exercise===2?<Recall form={form}/>:exercise===3?<Digits seed={seed}/>:exercise===4?<Quiz questions={logicForms[form]}/>:<Reading form={form}/>}</div>
      <button type="button" className="secondary-button" onClick={()=>setActive(false)}>Cerrar y borrar respuestas</button></>}
  </section>;
}
