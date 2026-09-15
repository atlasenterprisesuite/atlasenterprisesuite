export type MotionExpressionAst = { source: string };
export type MotionExpressionContext = { time: number; properties: Record<string, number> };

const forbidden = /(?:Function|eval|globalThis|window|document|process|constructor|prototype|__proto__|=>|\b(?:for|while|import|require|new|this)\b|[;{}\[\]=])/;
const allowedNames = new Set(['time','sin','cos','clamp','lerp']);

export function parseMotionExpression(source: string): MotionExpressionAst {
  if (!source.trim() || source.length > 512 || forbidden.test(source)) throw new Error('Unsafe motion expression');
  const names = source.match(/[A-Za-z_$][\w$]*/g) ?? [];
  for (const name of names) if (!allowedNames.has(name)) throw new Error(`Unsupported identifier: ${name}`);
  if (!/^[\d\s+\-*/%().,A-Za-z_$]+$/.test(source)) throw new Error('Unsupported expression syntax');
  return { source };
}

export function evaluateMotionExpression(ast: MotionExpressionAst, context: MotionExpressionContext): number {
  // Deliberately no eval/Function: parse a small arithmetic grammar.
  const tokens = ast.source.match(/\d+(?:\.\d+)?|[A-Za-z_$][\w$]*|[()+\-*/%,]/g) ?? [];
  let i=0;
  const expr=():number=>{ let v=term(); while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++];const r=term();v=op==='+'?v+r:v-r;} return v; };
  const term=():number=>{ let v=factor(); while(tokens[i]==='*'||tokens[i]==='/'||tokens[i]==='%'){const op=tokens[i++];const r=factor();v=op==='*'?v*r:op==='/'?v/r:v%r;} return v; };
  const factor=():number=>{ const t=tokens[i++]; if(t==='-') return -factor(); if(t==='('){const v=expr();if(tokens[i++]!==')')throw new Error('Expected )');return v;} if(/^\d/.test(t)) return Number(t); if(t==='time') return context.time; if(['sin','cos','clamp','lerp'].includes(t)){if(tokens[i++]!=='(')throw new Error('Expected (');const args:number[]=[];if(tokens[i]!==')'){args.push(expr());while(tokens[i]===','){i++;args.push(expr());}}if(tokens[i++]!==')')throw new Error('Expected )');if(t==='sin')return Math.sin(args[0]);if(t==='cos')return Math.cos(args[0]);if(t==='clamp')return Math.max(args[1],Math.min(args[2],args[0]));return args[0]+(args[1]-args[0])*args[2];} throw new Error('Invalid expression'); };
  const result=expr(); if(i!==tokens.length || !Number.isFinite(result)) throw new Error('Invalid motion expression result'); return result;
}
