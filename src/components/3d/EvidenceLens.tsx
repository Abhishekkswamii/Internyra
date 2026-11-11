"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EvidenceLensFallback } from "./EvidenceLensFallback";

/**
 * Evidence Inspection Instrument
 *
 * A document sits at the centre of an optical bench. Three glass planes (the link, the recruiter
 * communication, the supporting evidence) stand in front of and behind it, and a lens assembly rides
 * the rails in front. Everything is procedural geometry; no measurements or readouts are drawn.
 *
 * Interaction: pointer parallax, a clamped drag, and scroll that separates the planes.
 * The render loop only runs while the scene is on screen.
 */

interface EvidenceLensProps {
  className?: string;
  interactive?: boolean;
  /** 0..1. When given, it drives plane separation instead of page scroll (e.g. the three-step section). */
  progress?: number;
}

const COBALT = 0x345dff;
const ELECTRIC = 0x6488ff;

export const INSTRUMENT_3D_LABEL =
  "Interactive 3D Evidence Instrument. Drag to tilt it; scroll to separate its glass layers. Decorative.";

// --- procedural textures -------------------------------------------------------------------------

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}

function texture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Abstract page: grey bars stand in for text; one clause is highlighted. No legible text. */
function documentTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(640, 840);
  if (ctx) {
    ctx.fillStyle = "#f8f7f2";
    ctx.fillRect(0, 0, 640, 840);
    ctx.lineCap = "round";
    ctx.fillStyle = "#151925";
    ctx.fillRect(64, 70, 150, 16);
    ctx.fillStyle = "#d9d6cb";
    const rows = [
      [64, 140, 420], [64, 176, 500], [64, 212, 360], [64, 248, 470],
      [64, 320, 510], [64, 356, 440], [64, 392, 500], [64, 428, 300],
      [64, 500, 480], [64, 536, 420], [64, 572, 510], [64, 608, 340],
    ];
    for (const [x, y, w] of rows) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, 12, 6);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(216,238,112,0.95)";
    ctx.beginPath();
    ctx.roundRect(56, 346, 460, 34, 8);
    ctx.fill();
    ctx.fillStyle = "#b9b7ac";
    ctx.beginPath();
    ctx.roundRect(64, 356, 440, 12, 6);
    ctx.fill();
    ctx.fillStyle = "rgba(52,93,255,0.9)";
    ctx.fillRect(64, 626, 160, 5);
    ctx.fillStyle = "#151925";
    ctx.fillRect(64, 730, 110, 3);
  }
  return texture(c);
}

type Overlay = "link" | "message" | "evidence";

/** Transparent line-art for a glass plane. Shapes only, no words or numbers. */
function overlayTexture(kind: Overlay): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(640, 840);
  if (ctx) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(190,208,255,0.95)";
    ctx.fillStyle = "rgba(190,208,255,0.95)";
    ctx.lineWidth = 5;
    if (kind === "link") {
      const segs = [[64, 110, 110], [186, 110, 250], [448, 110, 120]];
      segs.forEach(([x, y, w], i) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, 46, 23);
        ctx.stroke();
        if (i === 1) {
          ctx.fillStyle = "rgba(216,238,112,0.9)";
          ctx.beginPath();
          ctx.roundRect(x + 14, y + 14, 70, 18, 9);
          ctx.fill();
          ctx.fillStyle = "rgba(190,208,255,0.95)";
        }
      });
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(64 + i * 63, 190);
        ctx.lineTo(64 + i * 63, i % 3 === 0 ? 226 : 210);
        ctx.stroke();
      }
    } else if (kind === "message") {
      const bubbles = [[64, 150, 330], [210, 290, 360], [64, 430, 300]];
      bubbles.forEach(([x, y, w], i) => {
        ctx.beginPath();
        ctx.roundRect(x, y, w, 96, 26);
        ctx.stroke();
        ctx.fillRect(x + 28, y + 30, w - 120, 9);
        ctx.fillRect(x + 28, y + 54, w - 170, 9);
        if (i === 1) {
          ctx.fillStyle = "rgba(216,238,112,0.9)";
          ctx.fillRect(x + 28, y + 52, 120, 13);
          ctx.fillStyle = "rgba(190,208,255,0.95)";
        }
      });
    } else {
      ctx.lineWidth = 3;
      for (let r = 0; r < 5; r++) {
        for (let q = 0; q < 4; q++) {
          ctx.beginPath();
          ctx.roundRect(70 + q * 128, 130 + r * 120, 104, 90, 12);
          ctx.stroke();
        }
      }
      ctx.fillStyle = "rgba(52,93,255,0.55)";
      ctx.beginPath();
      ctx.roundRect(70 + 128, 130 + 120, 104, 90, 12);
      ctx.fill();
      ctx.fillStyle = "rgba(216,238,112,0.85)";
      ctx.beginPath();
      ctx.roundRect(70 + 3 * 128, 130 + 3 * 120, 104, 90, 12);
      ctx.fill();
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(48, 232);
      ctx.lineTo(48, 108);
      ctx.lineTo(172, 108);
      ctx.stroke();
    }
  }
  return texture(c);
}

function scanTexture(): THREE.CanvasTexture {
  const [c, ctx] = makeCanvas(4, 128);
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, "rgba(100,136,255,0)");
    g.addColorStop(0.5, "rgba(140,170,255,0.9)");
    g.addColorStop(1, "rgba(100,136,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
  }
  return new THREE.CanvasTexture(c);
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export default function EvidenceLens({ className = "", interactive = true, progress }: EvidenceLensProps) {
  const progressRef = useRef<number | undefined>(progress);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasWebGL] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const c = document.createElement("canvas");
      return Boolean(c.getContext("webgl2") || c.getContext("webgl") || c.getContext("experimental-webgl"));
    } catch {
      return false;
    }
  });
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  const [rendererFailed, setRendererFailed] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const root = rootRef.current;
    if (!container || !root || !hasWebGL || reduced || rendererFailed) return;

    const lowPower = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;

    const scene = new THREE.Scene();
    const width = container.clientWidth || 480;
    const height = container.clientHeight || 480;
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 60);

    // Back the camera off until the instrument fits the narrower axis of the canvas.
    const fitCamera = (dolly: number) => {
      const halfV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const need = 2.05 / (halfV * Math.min(1, camera.aspect));
      camera.position.set(0, 0, need + 1.2 - dolly);
      camera.lookAt(0, 0, 0);
    };
    fitCamera(0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 2));
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      container.appendChild(renderer.domElement);
    } catch {
      queueMicrotask(() => setRendererFailed(true));
      return;
    }
    // Software rasterisers (SwiftShader, llvmpipe) are far too slow for 60 fps and would starve the page,
    // so they get one pixel per CSS pixel and a low frame cap.
    let software = false;
    try {
      const gl = renderer.getContext();
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
      software = /swiftshader|llvmpipe|software/i.test(name);
    } catch {
      /* unknown renderer: assume hardware */
    }
    if (software) renderer.setPixelRatio(1);
    const minFrameMs = software ? 100 : 0;
    let lastDraw = 0;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setRendererFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);

    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    // Environment reflections: without them glass and metal read as flat.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTexture = track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
    scene.environment = envTexture;
    scene.environmentIntensity = 0.9;
    pmrem.dispose();

    const key = new THREE.DirectionalLight(0xfff4e0, 2.1);
    key.position.set(3, 4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(ELECTRIC, 3.2);
    rim.position.set(-5, 1, -4);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xdfe6ff, 0.35));

    // --- materials --------------------------------------------------------------------------------
    const glassMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xdbe6ff,
        metalness: 0,
        roughness: 0.04,
        transparent: true,
        opacity: 0.17,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    const metalMat = track(new THREE.MeshStandardMaterial({ color: 0xd3d7e0, metalness: 1, roughness: 0.26 }));
    const darkMat = track(new THREE.MeshStandardMaterial({ color: 0x1c2235, metalness: 0.85, roughness: 0.38 }));
    const glowMat = track(new THREE.MeshStandardMaterial({ color: COBALT, emissive: COBALT, emissiveIntensity: 1.6, roughness: 0.4 }));

    const rig = new THREE.Group();
    scene.add(rig);

    // --- document (centre) ------------------------------------------------------------------------
    const docTex = track(documentTexture());
    const doc = new THREE.Mesh(
      track(new THREE.PlaneGeometry(1.5, 1.97)),
      track(new THREE.MeshStandardMaterial({ map: docTex, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }))
    );
    rig.add(doc);

    // --- three glass planes -----------------------------------------------------------------------
    const PLANE_W = 1.9;
    const PLANE_H = 2.5;
    const planeGeo = track(new THREE.ShapeGeometry(roundedRectShape(PLANE_W, PLANE_H, 0.1), 12));
    const frameShape = roundedRectShape(PLANE_W, PLANE_H, 0.1);
    frameShape.holes.push(roundedRectShape(PLANE_W - 0.07, PLANE_H - 0.07, 0.08));
    const frameGeo = track(new THREE.ExtrudeGeometry(frameShape, { depth: 0.025, bevelEnabled: false, curveSegments: 10 }));
    const overlayGeo = track(new THREE.PlaneGeometry(PLANE_W * 0.92, PLANE_H * 0.92));

    const layers: { group: THREE.Group; z: number }[] = [];
    // z offsets at rest; scrolling multiplies them.
    ([
      ["link", 0.5],
      ["evidence", 1.0],
      ["message", -0.5],
    ] as [Overlay, number][]).forEach(([kind, z]) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(planeGeo, glassMat));
      const frame = new THREE.Mesh(frameGeo, metalMat);
      frame.position.z = -0.0125;
      g.add(frame);
      const tex = track(overlayTexture(kind));
      const overlay = new THREE.Mesh(
        overlayGeo,
        track(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.95 }))
      );
      overlay.position.z = 0.004;
      g.add(overlay);
      rig.add(g);
      layers.push({ group: g, z });
    });

    // --- scan light sweeping across every layer ---------------------------------------------------
    const scanTex = track(scanTexture());
    const scanMat = track(
      new THREE.MeshBasicMaterial({ map: scanTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85 })
    );
    const scanGeo = track(new THREE.PlaneGeometry(PLANE_W * 0.96, 0.5));
    const scans = layers.map((l) => {
      const m = new THREE.Mesh(scanGeo, scanMat);
      m.position.z = 0.012;
      l.group.add(m);
      return m;
    });
    const docScan = new THREE.Mesh(scanGeo, scanMat);
    docScan.position.z = 0.01;
    docScan.scale.x = 0.8;
    rig.add(docScan);

    // --- optical bench: rails + lens ---------------------------------------------------------------
    const railGeo = track(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 20));
    [-1.2, 1.2].forEach((x) => {
      const rail = new THREE.Mesh(railGeo, metalMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, -0.28, 1.6);
      rig.add(rail);
    });

    const lens = new THREE.Group();
    lens.add(new THREE.Mesh(track(new THREE.TorusGeometry(0.62, 0.075, 28, 110)), darkMat));
    lens.add(new THREE.Mesh(track(new THREE.TorusGeometry(0.545, 0.014, 12, 110)), glowMat));
    lens.add(new THREE.Mesh(track(new THREE.CircleGeometry(0.54, 64)), glassMat));
    const grip = new THREE.InstancedMesh(track(new THREE.BoxGeometry(0.018, 0.05, 0.1)), metalMat, 72);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      m4.compose(
        new THREE.Vector3(Math.cos(a) * 0.7, Math.sin(a) * 0.7, 0),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, a)),
        new THREE.Vector3(1, 1, 1)
      );
      grip.setMatrixAt(i, m4);
    }
    lens.add(grip);
    const arm = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.07, 0.07)), darkMat);
    arm.position.set(0.95, 0, 0);
    lens.add(arm);
    const slide = new THREE.Mesh(track(new THREE.BoxGeometry(0.14, 0.18, 0.2)), metalMat);
    slide.position.x = 1.25;
    lens.add(slide);
    lens.position.set(-0.2, -0.28, 1.75);
    rig.add(lens);

    // --- interaction state ------------------------------------------------------------------------
    const baseX = 0.12;
    const baseY = -0.6;
    rig.rotation.set(baseX, baseY, 0);
    let targetX = baseX;
    let targetY = baseY;
    let spreadTarget = 1;
    let spread = 1;
    let dollyTarget = 0;
    let dolly = 0;
    let dragging = false;
    let sx = 0;
    let sy = 0;
    let startX = baseX;
    let startY = baseY;
    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

    const onMove = (e: PointerEvent) => {
      if (dragging) {
        const max = Math.PI / 4;
        targetY = clamp(startY + (e.clientX - sx) * 0.005, baseY - max, baseY + max);
        targetX = clamp(startX - (e.clientY - sy) * 0.005, baseX - max, baseX + max);
        return;
      }
      if (e.pointerType === "touch") return;
      const r = container.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 2 - 1;
      const y = -(((e.clientY - r.top) / r.height) * 2 - 1);
      if (Math.abs(x) > 1.4 || Math.abs(y) > 1.4) return;
      targetY = baseY + x * 0.22;
      targetX = baseX - y * 0.14;
    };
    const onDown = (e: PointerEvent) => {
      if (!interactive) return;
      dragging = true;
      sx = e.clientX;
      sy = e.clientY;
      startX = rig.rotation.x;
      startY = rig.rotation.y;
      root.dataset.state = "interacting";
      container.setPointerCapture?.(e.pointerId);
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      targetX = baseX;
      targetY = baseY;
      root.dataset.state = "idle";
      try {
        container.releasePointerCapture?.(e.pointerId);
      } catch {
        /* pointer already released */
      }
    };
    const onScroll = () => {
      if (progressRef.current !== undefined) return;
      const rect = root.getBoundingClientRect();
      // 0 while the instrument sits fully in view at the top of the page, 1 as it leaves.
      const p = clamp(-rect.top / (rect.height * 0.9), 0, 1);
      spreadTarget = 1 + p * 1.1;
      dollyTarget = p * 0.9;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointermove", onMove);
    container.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    onScroll();

    // --- render loop: only scheduled while visible --------------------------------------------------
    let raf = 0;
    let visible = true;
    const t0 = performance.now();

    const frame = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (minFrameMs && performance.now() - lastDraw < minFrameMs) {
        raf = requestAnimationFrame(frame);
        return;
      }
      lastDraw = performance.now();
      const t = (performance.now() - t0) / 1000;
      const k = 0.075;
      if (progressRef.current !== undefined) {
        spreadTarget = 1 + progressRef.current * 1.1;
        dollyTarget = progressRef.current * 0.6;
      }
      rig.rotation.x += (targetX - rig.rotation.x) * k;
      rig.rotation.y += (targetY - rig.rotation.y) * k;
      spread += (spreadTarget - spread) * k;
      dolly += (dollyTarget - dolly) * k;
      fitCamera(dolly);

      layers.forEach((l) => (l.group.position.z = l.z * spread));
      lens.position.z = 1.55 + 0.3 * spread;
      // The scan sweeps the full height about every 7s, easing at each end.
      const phase = (Math.sin((t / 7) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const y = (phase - 0.5) * (PLANE_H - 0.3);
      scans.forEach((s) => (s.position.y = y));
      docScan.position.y = y;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        if (visible) start();
        else stop();
      },
      { threshold: 0.02 }
    );
    io.observe(container);
    const onVis = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVis);
    start();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      disposables.forEach((d) => d.dispose());
      grip.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [hasWebGL, interactive, reduced, rendererFailed]);

  if (!hasWebGL || reduced || rendererFailed) {
    return <EvidenceLensFallback className={className} />;
  }

  return (
    <div
      ref={rootRef}
      data-state="idle"
      role="img"
      aria-label={INSTRUMENT_3D_LABEL}
      className={`relative select-none ${className}`}
    >
      <div ref={containerRef} className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing" />
    </div>
  );
}
