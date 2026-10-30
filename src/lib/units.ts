// Units that can be compared across datasets: each maps to a dimension and a conversion to its SI value.
interface UnitInfo {
  dim: string;
  si: (v: number) => number;
}

const scale = (dim: string, k: number): UnitInfo => ({ dim, si: (v) => v * k });

const UNITS: Record<string, UnitInfo> = {
  K: scale("temperature", 1),
  "°C": { dim: "temperature", si: (v) => v + 273.15 },
  "°F": { dim: "temperature", si: (v) => ((v - 32) * 5) / 9 + 273.15 },
  Å: scale("length", 1e-10),
  nm: scale("length", 1e-9),
  µm: scale("length", 1e-6),
  mm: scale("length", 1e-3),
  m: scale("length", 1),
  eV: scale("energy", 1.602176634e-19),
  keV: scale("energy", 1.602176634e-16),
  J: scale("energy", 1),
  Pa: scale("pressure", 1),
  mbar: scale("pressure", 100),
  bar: scale("pressure", 1e5),
  s: scale("time", 1),
  ms: scale("time", 1e-3),
  min: scale("time", 60),
  h: scale("time", 3600),
  Hz: scale("frequency", 1),
  MHz: scale("frequency", 1e6),
  GHz: scale("frequency", 1e9),
};

export const unitInfo = (unit: string): UnitInfo | undefined => UNITS[unit];

export function toSI(value: number, unit: string): { value: number; dim: string } | undefined {
  const u = UNITS[unit];
  return u && { value: u.si(value), dim: u.dim };
}
