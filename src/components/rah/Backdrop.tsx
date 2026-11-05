"use client";

// WebGL light backdrop. A single fullscreen triangle + fragment shader:
// slow flowing fields tinted by the live accent hue. Three styles (aurora,
// nebula, waves) switched by the coach's backdrop plugin. Deliberately
// restrained: it is a room's lighting, not a screensaver. No context or
// motion-off -> invisible, and the CSS gradient underneath remains.

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_hue;
uniform float u_mode;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
vec3 hsl(float h, float s, float l){
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float t = u_time * 0.03;
  vec3 base = vec3(0.059, 0.071, 0.102);
  vec3 col = base;
  if (u_mode < 0.5) {
    // aurora: vertical curtains of light
    float n = fbm(vec2(uv.x * 3.0, uv.y * 1.2) + vec2(t, -t * 0.5));
    float curtain = smoothstep(0.35, 0.95, fbm(vec2(uv.x * 4.0 + n * 1.5, uv.y * 0.8 - t)));
    col += hsl(u_hue / 360.0 + n * 0.06, 0.75, 0.5) * curtain * smoothstep(0.15, 0.8, uv.y) * 0.16;
    float n2 = fbm(vec2(uv.x * 2.5 - t * 0.7, uv.y * 1.1 + t * 0.4));
    col += hsl(fract(u_hue / 360.0 + 0.55), 0.7, 0.55) * smoothstep(0.5, 0.95, n2) * 0.07;
  } else if (u_mode < 1.5) {
    // nebula: domain-warped clouds
    vec2 p = uv * vec2(2.2, 1.6);
    vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
    float f = fbm(p + q * 1.8);
    col += hsl(u_hue / 360.0 + f * 0.12, 0.7, 0.45) * smoothstep(0.35, 0.9, f) * 0.15;
  } else {
    // waves: slow horizontal bands of light
    float w = sin((uv.y * 6.0 + fbm(vec2(uv.x * 2.0, t * 2.0)) * 3.0) + t * 2.0) * 0.5 + 0.5;
    float w2 = sin((uv.y * 4.0 - fbm(vec2(uv.x * 1.5 + 9.0, t * 1.5)) * 4.0) - t * 1.4) * 0.5 + 0.5;
    col += hsl(u_hue / 360.0, 0.75, 0.5) * w * w * 0.07;
    col += hsl(fract(u_hue / 360.0 + 0.5), 0.7, 0.5) * w2 * w2 * 0.05 * smoothstep(0.0, 0.6, uv.y);
  }
  float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x) * smoothstep(0.0, 0.1, uv.y);
  gl_FragColor = vec4(col * mix(1.0, edge, 0.6), 1.0);
}`;

export default function Backdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) {
      host.remove();
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("backdrop shader:", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      host.remove();
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uHue = gl.getUniformLocation(prog, "u_hue");
    const uMode = gl.getUniformLocation(prog, "u_mode");

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Style + hue are read from the appearance's data attributes / CSS var,
    // refreshed a few times a second so plugin switches apply live.
    let hue = 222;
    let mode = 0;
    let styleTick = 0;
    const syncStyle = () => {
      const r = document.documentElement;
      const b = r.dataset.backdrop ?? "aurora";
      mode = b === "nebula" ? 1 : b === "waves" ? 2 : b === "off" ? -1 : 0;
      const h = parseFloat(r.style.getPropertyValue("--hue"));
      if (Number.isFinite(h)) hue = h;
    };
    syncStyle();
    gl.uniform1f(uHue, hue);
    gl.uniform1f(uMode, mode);

    let raf = 0;
    let running = true;
    let last = 0;
    const frame = (t: number) => {
      if (!running) return;
      if (++styleTick % 30 === 0) syncStyle();
      if (mode < 0 || document.documentElement.dataset.motion === "off") {
        // plugin-disabled: draw one dark frame, then idle cheaply
        gl.clearColor(0.059, 0.071, 0.102, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);
        last = t;
        raf = requestAnimationFrame(frame);
        return;
      }
      if (t - last > 8) {
        gl.uniform1f(uTime, t / 1000);
        gl.uniform1f(uHue, hue);
        gl.uniform1f(uMode, mode);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        last = t;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return <div ref={ref} className="rah-backdrop" aria-hidden="true" />;
}
