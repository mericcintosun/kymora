import type { StripParams } from "@/lib/kymora/synth";

/**
 * Seeded demo strips. Each one is rendered in the browser (or on the server) from
 * its parameters by lib/kymora/synth.ts: the waveform is synthetic and its true
 * heart rate is known exactly, which is what lets every page show a reference value
 * next to the measured one. Scenarios describe where such a strip shows up in practice.
 */
export type StressTest = "baseline case" | "tilt" | "rhythm" | "resolution" | "blur" | "lighting";

export interface StripSeed {
  id: string;
  title: string;
  scenario: string;
  capture: string;
  stress: StressTest;
  params: StripParams;
}

export const strips: StripSeed[] = [
  {
    id: "sinus-72-tilted",
    title: "Resting sinus rhythm, phone photo",
    scenario: "A GP at a rural health post photographs the rhythm strip to send to a cardiologist.",
    capture: "Phone photo, 3.1° tilt, desk lamp shadow on the right",
    stress: "tilt",
    params: { seed: 1072, heartRateBpm: 72, rrJitterMs: 25, pxPerMm: 8, skewDeg: 3.1, blurPx: 0.6, noise: 0.025, shadow: 0.2 },
  },
  {
    id: "brady-48-scan",
    title: "Sinus bradycardia, flatbed scan",
    scenario: "Retrospective study pulling 2012 inpatient printouts from a paper archive.",
    capture: "Flatbed scan, almost straight, clean light",
    stress: "baseline case",
    params: { seed: 2048, heartRateBpm: 48, rrJitterMs: 30, pxPerMm: 9.5, skewDeg: 0.4, blurPx: 0, noise: 0.01, shadow: 0 },
  },
  {
    id: "tachy-128-ward",
    title: "Sinus tachycardia, ward printout",
    scenario: "Night shift nurse photographs a post-operative strip for the on-call registrar.",
    capture: "Phone photo, -2.2° tilt, mild blur",
    stress: "tilt",
    params: { seed: 3128, heartRateBpm: 128, rrJitterMs: 8, pxPerMm: 7, skewDeg: -2.2, blurPx: 0.8, noise: 0.03, shadow: 0.15 },
  },
  {
    id: "irregular-96",
    title: "Irregular RR spread, AF-like rhythm",
    scenario: "Outpatient cardiology wants the RR series, not just one rate, from an old printout.",
    capture: "Phone photo, RR spread of 170 ms (P waves still drawn, so not a true AF morphology)",
    stress: "rhythm",
    params: { seed: 4096, heartRateBpm: 96, rrJitterMs: 170, pxPerMm: 8.5, skewDeg: 1.4, blurPx: 0.5, noise: 0.02, shadow: 0.1 },
  },
  {
    id: "archive-64-cohort",
    title: "Archive scan from a 2009 cohort",
    scenario: "A student research project digitizing a box of yellowed screening ECGs.",
    capture: "Low-resolution scan at 6 px/mm, yellowed paper, soft focus",
    stress: "resolution",
    params: { seed: 5064, heartRateBpm: 64, rrJitterMs: 40, pxPerMm: 6, skewDeg: -0.8, blurPx: 1, noise: 0.04, shadow: 0.3 },
  },
  {
    id: "fax-82-lowres",
    title: "Fax copy at very low resolution",
    scenario: "A referral letter arrives by fax with the rhythm strip stapled to page two.",
    capture: "4.2 px/mm, noisy, the 1 mm grid is barely resolved",
    stress: "resolution",
    params: { seed: 6082, heartRateBpm: 82, rrJitterMs: 20, pxPerMm: 4.2, skewDeg: 0.6, blurPx: 0.8, noise: 0.05, shadow: 0 },
  },
  {
    id: "blurred-75-motion",
    title: "Motion-blurred phone photo",
    scenario: "Photo taken one-handed in a corridor. Kymora should refuse this one.",
    capture: "Heavy blur (3.5 px), 2.5° tilt, noise",
    stress: "blur",
    params: { seed: 7075, heartRateBpm: 75, rrJitterMs: 25, pxPerMm: 8, skewDeg: 2.5, blurPx: 3.5, noise: 0.04, shadow: 0.1 },
  },
  {
    id: "steep-110-tilt",
    title: "Steep tilt under hallway light",
    scenario: "Emergency triage nurse snaps a strip balanced on a clipboard.",
    capture: "5.5° tilt, strong shadow, mild blur",
    stress: "tilt",
    params: { seed: 8110, heartRateBpm: 110, rrJitterMs: 15, pxPerMm: 7.5, skewDeg: 5.5, blurPx: 0.7, noise: 0.03, shadow: 0.35 },
  },
  {
    id: "athlete-58",
    title: "Athlete screening, sinus arrhythmia",
    scenario: "University sports medicine clinic reviews pre-participation strips in bulk.",
    capture: "Phone photo, RR varies with breathing (60 ms spread)",
    stress: "rhythm",
    params: { seed: 9058, heartRateBpm: 58, rrJitterMs: 60, pxPerMm: 9, skewDeg: -1.1, blurPx: 0.4, noise: 0.02, shadow: 0.05 },
  },
  {
    id: "shadow-88",
    title: "Heavy shadow across the strip",
    scenario: "Photo taken under a window with the phone's own shadow over half the paper.",
    capture: "Shadow darkens the right half by about a third, 1.9° tilt",
    stress: "lighting",
    params: { seed: 10088, heartRateBpm: 88, rrJitterMs: 20, pxPerMm: 8, skewDeg: 1.9, blurPx: 1.2, noise: 0.05, shadow: 0.7 },
  },
  {
    id: "brady-40-care-home",
    title: "Marked bradycardia, care home printout",
    scenario: "Visiting physician checks whether a resident's slow rate is new. A wrong rate here is the harm case.",
    capture: "Phone photo, 0.9° tilt, clean light",
    stress: "rhythm",
    params: { seed: 11040, heartRateBpm: 40, rrJitterMs: 30, pxPerMm: 8.8, skewDeg: 0.9, blurPx: 0.3, noise: 0.02, shadow: 0.1 },
  },
  {
    id: "tachy-150-ed",
    title: "Fast rhythm, emergency department strip",
    scenario: "Strip printed during a palpitations episode, photographed for the discharge letter.",
    capture: "Phone photo, -3.4° tilt, mild blur",
    stress: "tilt",
    params: { seed: 12150, heartRateBpm: 150, rrJitterMs: 6, pxPerMm: 8, skewDeg: -3.4, blurPx: 0.6, noise: 0.03, shadow: 0.2 },
  },
];

export const FEATURED_STRIP_ID = "sinus-72-tilted";

export function stripById(id: string): StripSeed | undefined {
  return strips.find((s) => s.id === id);
}
