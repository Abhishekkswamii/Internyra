/**
 * Original hero media (public/images/internyra/). The still exists; the intro/loop film does not yet
 * (see docs/INTERNYRA_MEDIA_GENERATION_BRIEF.md), so the hero shows the still alone. When `intro` and
 * `loop` are added, HeroMedia plays poster -> intro -> loop automatically.
 */
export interface HeroMediaConfig {
  /** Still shown before playback, under reduced motion, and if video fails. */
  poster: string;
  /** Smaller still for phones. */
  posterMobile?: string;
  /** Short intro clip. Playback starts muted and inline. */
  intro?: string;
  /** Seamless loop, loaded only after the intro has started playing. */
  loop?: string;
  width: number;
  height: number;
  alt: string;
}

export const HERO_MEDIA: HeroMediaConfig | null = {
  poster: "/images/internyra/hero-inspection-instrument.webp",
  posterMobile: "/images/internyra/hero-inspection-instrument-640w.webp",
  width: 1264,
  height: 848,
  alt: "A precision optical inspection instrument with a glass lens, scanning several thin translucent sheets of paper with a beam of blue light.",
};

export const IMAGES = {
  desk: {
    src: "/images/internyra/internship-review-desk.webp",
    small: "/images/internyra/internship-review-desk-640w.webp",
    width: 1264,
    height: 848,
    alt: "A printed offer letter on a stone desk with a glass lens resting on it, a closed laptop, a blue ceramic vase and a notebook in natural window light.",
  },
  evidence: {
    src: "/images/internyra/evidence-layer-detail.webp",
    small: "/images/internyra/evidence-layer-detail-640w.webp",
    width: 1200,
    height: 896,
    alt: "Close-up of translucent paper fibres between two glass layers held by brass knurled posts, lit with a soft blue glow.",
  },
} as const;
