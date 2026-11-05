"use client";

// WebGL aura: a full-bleed animated backdrop rendered on a raw WebGL1 canvas.
// Three slow drifting glows in the theme's primary color sit behind the whole
// shell and react to theme changes via the `rah-theme` event. Respects
// prefers-reduced-motion and pauses when the tab is hidden. Fixed, silent,
// pointer-transparent: it is wallpaper, not a toy.

import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_color;

float glow(vec2 uv, vec2 center, float radius, float strength) {
  float d = distance(uv, center);
  return strength * exp(-d * d / (radius * radius));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  float t = u_time;

  float g1 = glow(p, vec2(0.85 * aspect + sin(t * 0.11) * 0.06, 0.92 + cos(t * 0.07) * 0.05), 0.55, 0.20);
  float g2 = glow(p, vec2(0.12 * aspect + cos(t * 0.09) * 0.08, 0.10 + sin(t * 0.13) * 0.06), 0.65, 0.14);
  float g3 = glow(p, vec2(0.5 * aspect + sin(t * 0.05 + 2.0) * 0.10, 0.5 + cos(t * 0.08 + 1.0) * 0.08), 0.85, 0.05);

  float a = g1 + g2 + g3;
  vec3 col = u_color * a;
  gl_FragColor = vec4(col, min(a, 0.55));
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function readPrimary(): [number, number, number] {
  if (typeof window === "undefined") return [0.31, 0.55, 1];
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--c-primary").trim();
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
    return [parts[0] / 255, parts[1] / 255, parts[2] / 255];
  }
  return [0.31, 0.55, 1];
}

export default function AuraCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return; // graceful fallback: the CSS gradients in globals.css carry the look

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
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
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "u_res");
    const uTime = gl.getUniformLocation(prog, "u_time");
    const uColor = gl.getUniformLocation(prog, "u_color");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let start = performance.now();
    let color = readPrimary();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const draw = (now: number) => {
      resize();
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform3f(uColor, color[0], color[1], color[2]);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = (now: number) => {
      if (!document.hidden) draw(now);
      raf = requestAnimationFrame(loop);
    };

    resize();
    draw(start);
    if (!reduced) raf = requestAnimationFrame(loop);

    const onTheme = () => {
      color = readPrimary();
      draw(performance.now()); // instant repaint in the new accent
      start = performance.now() - 30000; // keep drift phase calm
    };
    window.addEventListener("rah-theme", onTheme);
    window.addEventListener("resize", onTheme);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("rah-theme", onTheme);
      window.removeEventListener("resize", onTheme);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 h-full w-full opacity-[0.16]"
      style={{ zIndex: 0, mixBlendMode: "screen" }}
    />
  );
}
