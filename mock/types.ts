import type { Dataset } from "@/types";

// How a seeded image is drawn. The first five are generated art; the rest are rendered from the physics of each technique.
export type ThumbStyle = "rings" | "spots" | "micrograph" | "spectrum" | "bands" | "sans" | "single" | "laue" | "radiograph" | "sqw" | "qens" | "powder" | "reflect" | "ins";

// What the mock keeps beside a dataset to draw its image attachment
export interface ThumbSpec {
  thumbSeed: number;
  thumbStyle: ThumbStyle;
  thumbHue: number;
}
export type SeedDataset = Dataset & Partial<ThumbSpec>;
