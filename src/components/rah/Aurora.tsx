"use client";

// Aurora: a WebGL light field behind the app. Raw WebGL, no dependencies.
// It reads the accent tokens from CSS custom properties, so the appearance
// plugin repaints the light the same moment it repaints the buttons.
// Falls back silently: no WebGL, no motion preference, or a hidden tab all
// leave the plain CSS gradient underneath.

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;

float blob(vec2 uv, vec2 c, float r){
  float d = distance(uv, c);
  return smoothstep(r, 0.0, d);
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes.xy;
  vec2 p = uv; p.x *= uRes.x / uRes.y;

  float t = uTime * 0.055;
  vec2 c1 = vec2(0.85 + 0.10*sin(t*1.1), 0.92 + 0.07*cos(t*0.9));
  vec2 c2 = vec2(0.12 + 0.08*cos(t*0.8 + 2.0), 0.15 + 0.09*sin(t*1.2 + 1.0));
  vec2 c3 = vec2(0.55 + 0.14*sin(t*0.6 + 4.0), 0.55 + 0.12*cos(t*0.7 + 3.0));

  float a = blob(p, c1 * vec2(uRes.x/uRes.y, 1.0), 0.55);
  float b = blob(p, c2 * vec2(uRes.x/uRes.y, 1.0), 0.50);
  float c = blob(p, c3 * vec2(uRes.x/uRes.y, 1.0), 0.62);

  vec3 col = vec3(0.0);
  col += uA * a * 0.20;
  col += uB * b * 0.13;
  col += uC * c * 0.10;
  // faint grain so large gradients never band
  float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
  col += (g - 0.5) * 0.012;

  gl_FragColor = vec4(col, 1.0);
}`;

function hexToVec3(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function readAccent(): { a: [number, number, number]; b: [number, number, number]; c: [number, number, number] } | null {
  const cs = getComputedStyle(document.documentElement);
  const a = hexToVec3(cs.getPropertyValue("--pri"));
  const b = hexToVec3(cs.getPropertyValue("--pri-deep"));
  if (!a || !b) return null;
  return { a, b, c: [0.19, 0.62, 0.72] }; // fixed teal third light, per the design system
}

export default function Aurora() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, depth: false, stencil: false });
    if (!gl) return; // CSS gradient stays

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, "uRes");
    const uTime = gl.getUniformLocation(prog, "uTime");
    const uA = gl.getUniformLocation(prog, "uA");
    const uB = gl.getUniformLocation(prog, "uB");
    const uC = gl.getUniformLocation(prog, "uC");

    let colors = readAccent();
    if (!colors) {
      colors = { a: [0.31, 0.55, 1.0], b: [0.18, 0.38, 0.77], c: [0.19, 0.62, 0.72] };
    }
    let target = colors;
    const applyTheme = () => {
      const next = readAccent();
      if (next) target = next;
    };
    window.addEventListener("rah-theme", applyTheme);

    const resize = () => {
      // half resolution: the field is soft, the GPU bill stays tiny
      const w = Math.max(1, Math.floor(window.innerWidth / 2));
      const h = Math.max(1, Math.floor(window.innerHeight / 2));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };
    resize();
    window.addEventListener("resize", resize);

    gl.uniform3fv(uA, colors.a);
    gl.uniform3fv(uB, colors.b);
    gl.uniform3fv(uC, colors.c);

    let raf = 0;
    let running = true;
    let last = performance.now();
    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // ease uniforms toward the theme target so a restyle feels like dusk, not a switch
      for (let i = 0; i < 3; i++) {
        colors.a[i] += (target.a[i] - colors.a[i]) * Math.min(1, dt * 1.4);
        colors.b[i] += (target.b[i] - colors.b[i]) * Math.min(1, dt * 1.4);
      }
      gl.uniform3fv(uA, colors.a);
      gl.uniform3fv(uB, colors.b);
      gl.uniform3fv(uC, colors.c);
      gl.uniform1f(uTime, now / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };

    if (reduced) {
      // one still frame, no animation loop
      gl.uniform1f(uTime, 40);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else {
      raf = requestAnimationFrame(frame);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          cancelAnimationFrame(raf);
          running = false;
        } else if (!running) {
          running = true;
          last = performance.now();
          raf = requestAnimationFrame(frame);
        }
      });
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("rah-theme", applyTheme);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-90"
      style={{ position: "fixed", inset: 0, zIndex: -10 }}
    />
  );
}
