# Internyra — media generation brief

**Status:** the three stills were added to `public/images/internyra/` by the project owner partway through the
second pass (no image- or video-generation tool was available to the build agent, which did not make them).
The hero **film does not exist yet**; the hero uses the still, and `HeroMedia` will play poster → intro → loop
once `intro` and `loop` are added to `HERO_MEDIA`.

Everything below is ready to run by someone with access to those tools.

## Shared art direction

- Light: one large soft key from upper left, warm ivory fill, a thin cobalt rim light from behind right.
- Palette: ivory `#F8F7F2`, deep ink `#151925`, cobalt `#345DFF`, electric `#6488FF`, one small citrus `#D8EE70` accent.
- Materials: machined anodised aluminium, optical glass, paper, matte plastic.
- Never: text, logos, watermarks, fictional UI, readable fabricated evidence, company names, certificates,
  floating icons, glowing brains, purple galaxies, faces or hands.

## Asset A — hero visual (wide, 16:10, deliver 2560×1600)

> Photorealistic studio product photograph. A precision optical inspection instrument on a warm ivory seamless
> backdrop: a machined aluminium frame holding a large round optical glass lens, positioned above several thin
> translucent sheets of paper and glass stacked in layers like an internship document, with soft controlled
> cobalt-blue refraction passing through the lens onto the top sheet. Elegant, minimal, expensive. Soft shadows,
> shallow depth of field, large negative space on the left third for headline text. No text, no logos, no
> interface elements, no watermark.

## Asset B — editorial supporting photograph (4:5 portrait, deliver 1600×2000)

> Editorial photograph of a carefully styled desk in natural window light: a printed internship offer letter
> (text blurred and unreadable, no letterhead or logo), a phone face-down beside it, and a modern silver laptop
> showing only a blurred neutral screen. A thin glass lens rests on the paper, magnifying one blurred line.
> Warm ivory and ink tones, a single cobalt accent object. Believable commercial photography, no people.

## Asset C — evidence visual (square, deliver 2000×2000)

> Macro editorial composition: three transparent acrylic-and-glass layers stacked at slight offsets over a paper
> document, one blurred clause highlighted with a pale citrus marker stroke, a subtle cobalt optical inspection
> plane crossing the layers with refracted light at its edges. All markings are abstract lines and blocks, no
> legible words or numbers. Same lighting and palette as Asset A.

## Hero film (Google Flow, 8 s intro + 6 s seamless loop, 16:10, 1080p)

> Macro product-commercial cinematography. Slow continuous dolly around a precision optical lens on a warm ivory
> studio set. Translucent layered paper sheets glide through the inspection plane; fine highlights separate
> into clear organised layers; cobalt light refracts through the glass. Restrained, smooth motion. Final frame is
> an orderly composition of the layers behind the lens. No text, no numbers, no interface, no particles, no
> watermark, no audio. Deliver the intro (8 s) and a separate loop (6 s) whose first and last frames match.

## Delivery and wiring

1. Keep originals in `public/images/internyra/source/` and web exports alongside:
   - stills: AVIF and WebP, widths 640 / 1280 / 2000 (`cwebp -q 82`, `ffmpeg` for AVIF);
   - video: H.264 MP4 and VP9 WebM, ≤ 2 MB intro and ≤ 1.5 MB loop at 1280 px, plus a 720 px mobile pair.
2. Record filename, dimensions, format and size in a table at the bottom of this file.
3. Set `HERO_MEDIA` in `src/lib/media.ts`. `HeroMedia` already implements the poster → intro → loop sequence,
   loads the loop only after the intro is playing, pauses offscreen, and falls back to the poster under reduced
   motion or on error. (It was exercised with temporary test clips, which were then removed.)
4. Add alt text for each still and rerun the full Playwright suite.

## Asset register

| File | Dimensions | Format | Size |
| --- | --- | --- | --- |
| hero-inspection-instrument.webp | 1264×848 | WebP | 48.7 KB |
| hero-inspection-instrument-640w.webp | 640×429 | WebP | 13.4 KB |
| internship-review-desk.webp | 1264×848 | WebP | 98.4 KB |
| internship-review-desk-640w.webp | 640×429 | WebP | 24.9 KB |
| evidence-layer-detail.webp | 1200×896 | WebP | 126.0 KB |
| evidence-layer-detail-640w.webp | 640×478 | WebP | 36.7 KB |
| source/hero-inspection-instrument.jpg | 1264×848 | JPEG | 592 KB |
| source/internship-review-desk.jpg | 1264×848 | JPEG | 701 KB |
| source/evidence-layer-detail.jpg | 1200×896 | JPEG | 728 KB |
| hero film (intro + loop) | — | — | not yet produced |
