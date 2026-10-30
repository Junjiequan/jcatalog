import { parse } from "yaml";
import bundledYaml from "../../config/app.yaml?raw";

// Reads and checks config/app.yaml. The bundled copy is the starting point, so settings are there from the first render;
// the copy served next to the page replaces it, so a deployment can change them without a rebuild.
export interface AppConfig {
  recentlyViewed: number;
}

const DEFAULTS: AppConfig = { recentlyViewed: 10 };

function check(text: string): { config: AppConfig; warnings: string[] } {
  const warnings: string[] = [];
  const config = { ...DEFAULTS };
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (e) {
    return { config, warnings: [`app.yaml is not valid YAML (${(e as Error).message.split("\n")[0]}); using the defaults`] };
  }
  const v = (doc as { recentlyViewed?: unknown } | null)?.recentlyViewed;
  if (v !== undefined) {
    if (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 50) config.recentlyViewed = v as number;
    else warnings.push(`recentlyViewed must be a whole number from 1 to 50; using ${DEFAULTS.recentlyViewed}`);
  }
  return { config, warnings };
}

let current = check(bundledYaml).config;
export const appConfig = (): AppConfig => current;

export async function loadAppConfig(): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}app.yaml`, { cache: "no-cache" });
    if (!res.ok) return;
    const { config, warnings } = check(await res.text());
    warnings.forEach((w) => console.warn(`[app.yaml] ${w}`));
    current = config;
  } catch {
    // keep the bundled settings
  }
}
