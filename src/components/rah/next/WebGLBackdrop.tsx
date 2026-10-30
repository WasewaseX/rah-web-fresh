"use client";

// WebGL backdrop: one fullscreen fragment shader behind the app. Three modes
// (aurora, waves, particles) plus "none". Theme-aware: reads the primary
// color from the CSS variable so the plugin recolors it too. Falls back
// silently when WebGL is unavailable or reduced motion is requested.

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_col;
uniform float u_mode;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  vec2 st = uv * vec2(u_res.x / u_res.y, 1.0);
  vec3 base = vec3(0.063, 0.075, 0.102);
  vec3 col = base;
  float t = u_time;

  if (u_mode < 0.5) {
    // aurora: two slow flowing bands
    float b1 = sin(st.x * 2.2 + t * 0.28) * 0.5 + sin(st.x * 4.7 - t * 0.19) * 0.25;
    float d1 = exp(-pow((uv.y - 0.62 - b1 * 0.16) * 4.2, 2.0));
    float b2 = cos(st.x * 1.7 - t * 0.22) * 0.5;
    float d2 = exp(-pow((uv.y - 0.30 - b2 * 0.12) * 5.0, 2.0));
    col += u_col * d1 * 0.16 + u_col * d2 * 0.10;
  } else if (u_mode < 1.5) {
    // waves: horizontal silk lines
    float w = sin(st.y * 9.0 + t * 0.5 + sin(st.x * 3.0 + t * 0.3) * 1.4);
    float mask = smoothstep(0.86, 0.99, w);
    col += u_col * mask * 0.07;
    float w2 = sin(st.y * 15.0 - t * 0.36 + sin(st.x * 2.2 - t * 0.24) * 1.1);
    col += u_col * smoothstep(0.93, 0.995, w2) * 0.05;
  } else {
    // particles: drifting stars
    vec2 g = floor(st * 26.0);
    vec2 f = fract(st * 26.0);
    float h = hash(g);
    if (h > 0.972) {
      vec2 c = vec2(hash(g + 1.3), hash(g + 7.7));
      float tw = 0.5 + 0.5 * sin(t * (0.6 + h) + h * 40.0);
      float d = length(f - c);
      col += u_col * smoothstep(0.16, 0.0, d) * tw * 0.5;
    }
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

export default function WebGLBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return; // CSS background carries the look

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uCol = gl.getUniformLocation(prog, "u_col");
    const uMode = gl.getUniformLocation(prog, "u_mode");

    let effect = localStorage.getItem("rah.effect") ?? "aurora";
    let mode = effect === "waves" ? 1 : effect === "particles" ? 2 : effect === "none" ? 3 : 0;
    const onEffect = (e: Event) => {
      effect = (e as CustomEvent).detail as string;
      mode = effect === "waves" ? 1 : effect === "particles" ? 2 : effect === "none" ? 3 : 0;
    };
    window.addEventListener("rah-effect", onEffect);

    const readColor = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--rah-primary").trim();
      const m = v.match(/^#([0-9a-f]{6})$/i);
      if (!m) return [0.31, 0.55, 1.0];
      const n = parseInt(m[1], 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    const t0 = performance.now();
    const draw = () => {
      const time = reduced ? 12.0 : (performance.now() - t0) / 1000;
      gl.uniform1f(uTime, time);
      gl.uniform1f(uMode, mode);
      const c = readColor();
      gl.uniform3f(uCol, c[0], c[1], c[2]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw();
    // Recolor once when the theme changes even under reduced motion.
    window.addEventListener("rah-theme", () => { if (reduced) draw(); }, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("rah-effect", onEffect);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
      style={{ display: "block" }}
    />
  );
}
