import { useEffect, useRef, useState } from 'react';

/**
 * Equirectangular 360 panorama viewer.
 * Renders only a caller-authorized image; it does not infer routes or scene truth.
 * The caller must enforce panoramaEvidence before providing imageUrl.
 */
export function Panorama360Viewer({ imageUrl, alt = 'Panoramic scene' }: {
  imageUrl: string;
  alt?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageUrl) return;
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};
    const gl = canvas.getContext('webgl', { alpha: false });
    if (!gl) { setError('WebGL unavailable'); return; }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('WebGL shader unavailable');
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(reason || 'Shader compilation failed');
      }
      return shader;
    };

    try {
      const vs = compile(gl.VERTEX_SHADER,
        'attribute vec2 a; varying vec2 v; void main(){v=a;gl_Position=vec4(a,0.,1.);}');
      const fs = compile(gl.FRAGMENT_SHADER, `
precision mediump float;
varying vec2 v;
uniform sampler2D pano;
uniform float yaw;
uniform float pitch;
uniform float fov;
uniform float aspect;
const float PI=3.141592653589793;
void main() {
  vec3 ray=normalize(vec3(v.x*aspect*tan(fov*0.5),v.y*tan(fov*0.5),-1.));
  float cp=cos(pitch),sp=sin(pitch);
  ray=vec3(ray.x,ray.y*cp-ray.z*sp,ray.y*sp+ray.z*cp);
  float cy=cos(yaw),sy=sin(yaw);
  ray=vec3(ray.x*cy+ray.z*sy,ray.y,-ray.x*sy+ray.z*cy);
  vec2 uv=vec2(fract(atan(ray.x,-ray.z)/(2.*PI)+0.5),acos(clamp(ray.y,-1.,1.))/PI);
  gl_FragColor=texture2D(pano,uv);
}`);
      const program = gl.createProgram();
      if (!program) throw new Error('WebGL program unavailable');
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('WebGL linking failed');
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'a');
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      let yaw=0, pitch=0, fov=Math.PI/2;
      let last: {x:number;y:number}|null=null;
      let loaded=false;
      const draw=()=>{
        if (disposed || !loaded) return;
        const w=canvas.clientWidth, h=canvas.clientHeight;
        if (!w || !h) return;
        const ratio=Math.min(window.devicePixelRatio||1,2);
        canvas.width=Math.max(1,Math.floor(w*ratio));
        canvas.height=Math.max(1,Math.floor(h*ratio));
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.uniform1f(gl.getUniformLocation(program,'yaw'),yaw);
        gl.uniform1f(gl.getUniformLocation(program,'pitch'),pitch);
        gl.uniform1f(gl.getUniformLocation(program,'fov'),fov);
        gl.uniform1f(gl.getUniformLocation(program,'aspect'),w/h);
        gl.drawArrays(gl.TRIANGLES,0,6);
      };
      const image=new Image();
      image.crossOrigin='anonymous';
      image.onload=()=>{
        if(disposed)return;
        gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        loaded=true;setError(null);draw();
      };
      image.onerror=()=>{if(!disposed)setError('Panorama unavailable or CORS denied');};
      image.src=imageUrl;
      const down=(e:PointerEvent)=>{last={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);};
      const move=(e:PointerEvent)=>{if(!last)return;yaw+=(e.clientX-last.x)*0.005;pitch=Math.max(-1.45,Math.min(1.45,pitch+(e.clientY-last.y)*0.005));last={x:e.clientX,y:e.clientY};draw();};
      const up=()=>{last=null;};
      const wheel=(e:WheelEvent)=>{e.preventDefault();fov=Math.max(0.5,Math.min(1.8,fov+Math.sign(e.deltaY)*0.08));draw();};
      const key=(e:KeyboardEvent)=>{if(e.key==='ArrowLeft')yaw-=0.1;else if(e.key==='ArrowRight')yaw+=0.1;else if(e.key==='ArrowUp')pitch=Math.max(-1.45,pitch-0.1);else if(e.key==='ArrowDown')pitch=Math.min(1.45,pitch+0.1);else return;e.preventDefault();draw();};
      const resize=new ResizeObserver(draw);resize.observe(canvas);
      canvas.addEventListener('pointerdown',down);
      canvas.addEventListener('pointermove',move);
      canvas.addEventListener('pointerup',up);
      canvas.addEventListener('pointercancel',up);
      canvas.addEventListener('wheel',wheel,{passive:false});
      canvas.addEventListener('keydown',key);
      cleanup=()=>{
        resize.disconnect();image.onload=null;image.onerror=null;image.src='';
        canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);
        canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);
        canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);
        gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);
        gl.deleteShader(vs);gl.deleteShader(fs);
      };
    } catch {
      setError('Panorama renderer failed');
    }
    return ()=>{disposed=true;cancelAnimationFrame(frame);cleanup();};
  },[imageUrl]);

  return <div style={{position:'relative',width:'100%',height:'100%',minHeight:260,background:'#061526'}}>
    <canvas ref={canvasRef} tabIndex={0} role="img" aria-label={alt}
      style={{width:'100%',height:'100%',touchAction:'none',display:'block',cursor:'grab'}}/>
    {error && <p role="alert" style={{position:'absolute',bottom:8,left:12,color:'white'}}>{error}</p>}
  </div>;
}
