# INTERNYRA — VISUAL MEDIA ASSET HANDOFF DOCUMENTATION

**Prepared By:** Creative Director & AI Visual Asset Engineer (Nano Banana Production Pipeline)  
**Target Consumer:** Claude Code (Engineering Lead for Internyra Redesign & Second-Pass Implementation)  
**Date:** November 11, 2026  
**Status:** Assets Generated, Web-Optimized, and Ready for Production Integration

---

## 1. Executive Summary

This handoff document details the three bespoke, photorealistic visual assets generated using Google Nano Banana for **Internyra** (`/Users/abhishek/Developer/Clg/Projects/Internyra`). 

Unlike generic SaaS stock photographs or synthetic UI mockups, these assets were produced under an editorial commercial product direction that balances:
- The mechanical refinement of a precision optical instrument manufacturer.
- The editorial elegance of an investigative intelligence publication.
- A restrained physical palette grounded in warm ivory (`#F8F7F2`), deep ink (`#151925`), and crisp optical white (`#FFFFFF`), with focused cobalt (`#345DFF`), electric blue (`#6488FF`), and citrus (`#D8EE70`) optical refraction highlights.
- Completely clean surfaces devoid of legible fake text, invented corporate logos, watermarks, floating UI artifacts, or plastic CGI textures.

All master source files (`.jpg`) are archived in `public/images/internyra/source/`, while production-ready WebP files and responsive mobile variants are deployed directly in `public/images/internyra/`.

---

## 2. Master Asset Register

| Asset Key | Target Filename | Mobile Variant (640w) | Master Source Archive | Native Dimensions | Aspect Ratio | WebP Size | Source Size | Recommended Usage |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Asset 01** | `hero-inspection-instrument.webp` | `hero-inspection-instrument-640w.webp` | `source/hero-inspection-instrument.jpg` | 1264 × 848 px | 3:2 Landscape | 48.7 KB | 578 KB | Homepage Hero (Right Anchor) |
| **Asset 02** | `internship-review-desk.webp` | `internship-review-desk-640w.webp` | `source/internship-review-desk.jpg` | 1264 × 848 px | 3:2 Landscape | 98.4 KB | 685 KB | Editorial Investigation / Process Section |
| **Asset 03** | `evidence-layer-detail.webp` | `evidence-layer-detail-640w.webp` | `source/evidence-layer-detail.jpg` | 1200 × 896 px | 4:3 Landscape | 126.0 KB | 711 KB | Evidence Multi-Layer Verification / Lens Detail |

---

## 3. Comprehensive Asset Details

### Asset 01 — Hero Master Visual
- **File Path:** `/images/internyra/hero-inspection-instrument.webp`
- **Responsive Mobile Path:** `/images/internyra/hero-inspection-instrument-640w.webp`
- **Master Source:** `/images/internyra/source/hero-inspection-instrument.jpg`
- **Native Dimensions:** 1264 × 848 px (Aspect ratio ~3:2)
- **File Format & Weight:** WebP (q88), 48.7 KB (Extremely light LCP candidate)
- **Composition & Layout:**
  - **Focal Anchor:** Positioned deliberately in the right 60% of the frame.
  - **Negative Space:** Clean, warm ivory gradient on the left 40% designed specifically to accommodate hero typography, badges, value proposition, and CTA buttons without visual collision.
- **Physical Subject:**
  - Precision-engineered optical inspection instrument machined from dark graphite anodized aluminum with knurled mechanical knobs and stainless steel alignment rods.
  - An optical-grade glass lens suspended over three translucent parchment-like document layers.
  - Controlled narrow blue-white optical beam refracting through the lens onto the document plane with subtle cobalt caustics.
  - Zero readable text, no digital overlays, no watermarks.
- **Suggested WCAG Alt Text:**
  > `"Precision dark graphite optical inspection instrument examining three layered translucent documents on a warm ivory studio surface with subtle cobalt blue refraction."`

---

### Asset 02 — Editorial Investigation Desk Photograph
- **File Path:** `/images/internyra/internship-review-desk.webp`
- **Responsive Mobile Path:** `/images/internyra/internship-review-desk-640w.webp`
- **Master Source:** `/images/internyra/source/internship-review-desk.jpg`
- **Native Dimensions:** 1264 × 848 px (Aspect ratio ~3:2)
- **File Format & Weight:** WebP (q88), 98.4 KB
- **Composition & Layout:**
  - **Perspective:** High-angle 45-degree editorial desk perspective with natural directional window light from the upper-left.
  - **Focal Subject:** An physical internship review document on high-grade archival paper resting beneath a heavy optical-grade circular glass magnifying lens.
  - **Supporting Elements:** Dark ink-toned notebook, machined brass pen, modern silver aluminum laptop edge (display neutral/blurred), subtle cobalt notebook edge and muted warm ivory background.
  - **Negative Space:** Balanced arrangement allowing split-column editorial layouts (text on left or right, image in opposite column).
- **Suggested WCAG Alt Text:**
  > `"Editorial workspace with a physical internship review document examined under an optical glass lens, alongside a notebook and laptop in natural warm studio light."`

---

### Asset 03 — Macro Evidence Layer Verification Visual
- **File Path:** `/images/internyra/evidence-layer-detail.webp`
- **Responsive Mobile Path:** `/images/internyra/evidence-layer-detail-640w.webp`
- **Master Source:** `/images/internyra/source/evidence-layer-detail.jpg`
- **Native Dimensions:** 1200 × 896 px (Aspect ratio ~4:3)
- **File Format & Weight:** WebP (q88), 126.0 KB
- **Composition & Layout:**
  - **Perspective:** Cinema-grade macro close-up with shallow depth of field.
  - **Focal Subject:** Three distinct physical verification layers (archival paper bottom, frosted translucent vellum middle, polished acrylic top) physically separated by miniature knurled dark aluminum spacers.
  - **Optical Highlighting:** A laser-sharp cobalt blue optical inspection beam casts a crisp horizontal inspection line across the middle translucent layer, creating genuine ray-traced internal refraction and soft chromatic dispersion at the glass edges.
  - **Abstract Markings:** Subtle geometric lines, micro-grids, and barcode-like abstractions (completely non-readable, no fake Latin or simulated alphanumeric gibberish).
- **Suggested WCAG Alt Text:**
  > `"Macro detail of three layered translucent documents separated by metal spacers, illuminated by a focused cobalt blue optical inspection beam."`

---

## 4. Integration Guidelines & Code Snippets

### A. Homepage Hero Component Integration

When wiring into the Hero section (or updating `src/lib/media.ts` / Hero component):

```tsx
import Image from 'next/image';

export function HeroVisual() {
  return (
    <div className="relative w-full aspect-[3/2] overflow-hidden rounded-2xl bg-[#F8F7F2] border border-[#151925]/10 shadow-[0_20px_50px_rgba(21,25,37,0.06)]">
      <Image
        src="/images/internyra/hero-inspection-instrument.webp"
        alt="Precision dark graphite optical inspection instrument examining three layered translucent documents on a warm ivory studio surface with subtle cobalt blue refraction."
        fill
        priority
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px"
        className="object-cover object-right md:object-center select-none pointer-events-none transition-transform duration-700 ease-out hover:scale-[1.02]"
      />
      {/* Subtle ambient lighting vignette overlay matching brand tokens */}
      <div 
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-[#345DFF]/[0.02] to-[#6488FF]/[0.04]" 
        aria-hidden="true" 
      />
    </div>
  );
}
```

### B. Investigation / Process Section Integration (Asset 02)

For alternating editorial narrative blocks:

```tsx
import Image from 'next/image';

export function InvestigationFeatureSection() {
  return (
    <section className="py-24 bg-[#F8F7F2] text-[#151925]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Editorial Narrative */}
        <div className="lg:col-span-5 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wide uppercase bg-[#345DFF]/10 text-[#345DFF] border border-[#345DFF]/20">
            Phase 02 // Document Scrutiny
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif font-normal tracking-tight leading-tight">
            Physical-grade scrutiny for modern internship claims.
          </h2>
          <p className="text-base text-[#151925]/70 leading-relaxed font-sans">
            Every verification dossier begins with thorough structural analysis. We examine the lineage, issuing authority, and cryptographic consistency before any badge is awarded.
          </p>
        </div>

        {/* Editorial Image Anchor */}
        <div className="lg:col-span-7">
          <div className="relative aspect-[3/2] w-full rounded-2xl overflow-hidden border border-[#151925]/10 shadow-lg bg-white">
            <Image
              src="/images/internyra/internship-review-desk.webp"
              alt="Editorial workspace with a physical internship review document examined under an optical glass lens, alongside a notebook and laptop in natural warm studio light."
              fill
              loading="lazy"
              sizes="(max-width: 1024px) 100vw, 680px"
              className="object-cover object-center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
```

### C. Multi-Layer Evidence Detail Card (Asset 03)

For the Evidence Engine or Verification breakdown:

```tsx
import Image from 'next/image';

export function EvidenceLayerCard() {
  return (
    <div className="relative group rounded-xl overflow-hidden border border-[#151925]/10 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#F8F7F2]">
        <Image
          src="/images/internyra/evidence-layer-detail.webp"
          alt="Macro detail of three layered translucent documents separated by metal spacers, illuminated by a focused cobalt blue optical inspection beam."
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 400px"
          className="object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
        />
        {/* Optical beam pulse indicator */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#151925]/80 backdrop-blur-md text-[#D8EE70] text-[11px] font-mono tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D8EE70] animate-pulse" />
          OPTICAL SCAN
        </div>
      </div>
      <div className="p-6">
        <h3 className="text-lg font-medium text-[#151925]">Tri-Layer Document Verification</h3>
        <p className="mt-2 text-sm text-[#151925]/60 leading-normal">
          Separates physical paper structure, digital timestamps, and institutional signature hashes into independently audited optical planes.
        </p>
      </div>
    </div>
  );
}
```

---

## 5. Responsive Behavior & Cropping Specifications

| Viewport | Container Behavior | `object-fit` | `object-position` | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Desktop (≥ 1280px)** | Constrained container (3:2 or 4:3) | `cover` | `center` (or `right center` for Hero) | Left negative space provides breathing room for floating overlays or titles. |
| **Tablet (768px – 1279px)** | Grid columns (50% or 60% width) | `cover` | `center` | Subject remains centered; optical beam remains high-contrast focal point. |
| **Mobile (< 768px)** | Full width stacked | `cover` | `center` / `65% center` (Hero) | For Asset 01, shifting `object-position: 65% center` ensures the optical instrument remains prominently framed while the negative space wraps naturally. |

---

## 6. Color Token Harmony Checklist

All three assets have been color-calibrated to align with the Internyra brand tokens:

- **Warm Ivory (`#F8F7F2`)**: Environment surface, background seamless, paper undertones.
- **Deep Ink (`#151925`)**: Anodized aluminum housing, shadows, notebook textures, high-contrast framing.
- **Pure Optical White (`#FFFFFF`)**: Key specular reflections, top-level acrylic highlights.
- **Cobalt Blue (`#345DFF`)**: Primary optical inspection wavelength, caustics, and lens flare.
- **Electric Blue (`#6488FF`)**: Dispersion fringe, edge refraction, secondary beam reflections.
- **Restrained Citrus (`#D8EE70`)**: Calibrated to match status badges and active indicators across the UI.

---

## 7. Quality Assurance Verification

- [x] **No Legible Text:** Verified. All document markings consist of micro-lines, abstract document grids, and geometric blocks. No fictitious company names, dates, or latin strings appear.
- [x] **No Fake Logos or Seals:** Verified. No artificial university crests, governmental stamps, or invented corporate badges.
- [x] **No Synthetic Floating UI:** Verified. The composition relies strictly on physical materials (glass, aluminum, acrylic, paper).
- [x] **Lightweight Performance:** All three web deliverables are under 130 KB, with the hero visual delivering at a hyper-efficient 48.7 KB.
- [x] **Mobile Srcset Prepared:** Matching 640px-wide WebP assets (13 KB - 36 KB) generated for seamless responsive delivery.

---

## 8. Image Generation Observations & Limitations (Item 10)

During prompt engineering and iterative image synthesis via Google Nano Banana (`image-generator`), the following constraints and mitigations were established:

1. **Native Aspect Ratio & Resolution Output:**
   - Nano Banana outputs high-detail landscape compositions at native resolutions of 1264 × 848 px (exact 3:2 landscape) and 1200 × 896 px (exact 4:3 landscape).
   - *Mitigation:* Rather than applying synthetic interpolation or artificial upscaling (which introduces muddy halos or plastic micro-blur), the native master outputs were preserved at their pristine pixel-crisp quality and compressed with WebP q88 (`cwebp`), yielding exceptional fidelity while maintaining fast load times (< 130 KB per asset).
2. **Text & Document Lineage Control:**
   - Early generation passes can occasionally attempt to render simulated text or pseudo-Latin letters onto document surfaces.
   - *Mitigation:* Iterative prompt constraints explicitly mandated abstract line structures, technical micro-grids, and non-readable document markings. Rejected earlier passes (`evidence_layer_detail` v1/v2) in favor of the finalized v3 master, ensuring 100% clean, non-readable, professional document textures.
3. **Refraction Physics vs. Digital Artifacts:**
   - Many standard generative diffusion models render blue optical refractions as flat fluorescent gradients or floating neon UI elements.
   - *Mitigation:* Physical constraints were framed around ray-traced optical caustics, machined dark graphite anodized aluminum, and real glass transmission indices. This ensured authentic internal refractions rather than synthetic digital glow.
4. **Hero Negative Space Alignment:**
   - Standard centered product framing encroaches on headline typography.
   - *Mitigation:* Specifically directed the optical assembly to anchor across the right 60% of the canvas, ensuring the left 40% remains an uninterrupted, low-contrast warm ivory gradient.

---

## 9. Quick-Reference Checklist for Claude Code

| # | Handoff Requirement | Covered In | Summary |
| :- | :--- | :--- | :--- |
| **1** | Exact filenames | Section 2 | `hero-inspection-instrument.webp`, `internship-review-desk.webp`, `evidence-layer-detail.webp` |
| **2** | Actual output dimensions | Section 2 & 3 | `1264 × 848` (3:2), `1264 × 848` (3:2), `1200 × 896` (4:3) + `640px` mobile variants |
| **3** | Formats | Section 2 | Production WebP (`q88` / `q85`), Master JPEG |
| **4** | File sizes | Section 2 | 48.7 KB, 98.4 KB, 126.0 KB (mobile: 13.4 KB, 24.9 KB, 36.7 KB) |
| **5** | Original source locations | Section 2 & 3 | `public/images/internyra/source/` |
| **6** | Recommended website usage | Section 3 & 4 | Hero Right Anchor, Process Editorial Section, Multi-Layer Evidence Card |
| **7** | `object-fit` & `object-position` | Section 5 | `object-cover`, `object-right md:object-center` (Hero), `object-center` |
| **8** | Responsive cropping guidance | Section 5 | Breakpoint-specific container rules, 65% focal shift on mobile |
| **9** | Suggested accessible alt text | Section 3 | Concise, descriptive, WCAG-compliant alt strings without marketing fluff |
| **10** | Generation limitations | Section 8 | Native resolution fidelity, prompt iteration mitigations, and physics constraints |


