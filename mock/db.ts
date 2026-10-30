import type {
  Attachment,
  Dataset,
  DatasetLifecycle,
  HistoryEvent,
  Instrument,
  InstrumentMeta,
  Job,
  JobKind,
  JobStatus,
  MetaValue,
  Proposal,
  PublishedData,
  Sample,
  Storage,
  Technique,
} from "@/types";
import type { SeedDataset, ThumbStyle } from "./types";
import { textToDataUrl } from "@/lib/attachments";
import { thumbUrl } from "./images/art";

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20240611);
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
const flt = (a: number, b: number, d = 2) => +(a + rnd() * (b - a)).toFixed(d);
const chance = (p: number) => rnd() < p;
const shuffle = <T,>(a: T[]) => [...a].sort(() => rnd() - 0.5);
const DAY = 86400000;
// the start of today (UTC): the seed is the same on every reload within a day, so links, selections and recent items keep pointing at the same records
const NOW = Math.floor(Date.now() / DAY) * DAY;
const GB = 1024 ** 3;

// what each technique's data looks like on screen
export const THUMB_OF: Record<string, ThumbStyle> = { SANS: "sans", Diffraction: "powder", Engineering: "powder", Reflectometry: "reflect", "Single-crystal": "single", MX: "laue", Imaging: "radiograph", Spectroscopy: "sqw", Backscattering: "qens", Vibrational: "ins" };

// who the seed treats as "mine" when it decides what is shared, which jobs exist and so on (the demo user of the login page)
const SEED_USER = {
  name: "Dr. Ada Okafor",
  email: "ada.okafor@example.org",
  groups: ["bio-sax", "ada-lab"],
};

const emailOf = (name: string) =>
  name
    .replace(/^(Dr\.|Prof\.)\s*/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .split(" ")
    .join(".") + "@example.org";

// The ESS instrument suite plus the Test Beamline. Sectors are the real ones; beamport numbers are left out. Drawings: ESS (see public/instruments/CREDITS.md).
interface InstrumentSeed extends InstrumentMeta {
  id: string;
  name: string;
  // how the instrument's generated art was drawn, when it has no drawing
  style: ThumbStyle;
  hue: number;
}
const INSTRUMENT_SEEDS: InstrumentSeed[] = [
  { id: "loki", name: "LoKI", title: "Broadband SANS", kind: "SANS instrument", location: "North sector · Hall D03", status: "online", techniques: ["SANS"], style: "rings", hue: 265, image: "/instruments/loki.png", contact: "Dr. Sofia Marin", description: "Broadband small-angle scattering for soft matter and biology, covering a wide q range in a single setting with a bent-tube detector bank." },
  { id: "skadi", name: "SKADI", title: "General-purpose SANS", kind: "SANS instrument", location: "North sector · Hall D03", status: "maintenance", techniques: ["SANS"], style: "rings", hue: 265, image: "/instruments/skadi.png", contact: "Dr. Priya Nair", description: "General-purpose SANS with polarisation analysis, built for magnetic nanostructures, hard matter and complex fluids." },
  { id: "estia", name: "ESTIA", title: "Focusing reflectometer", kind: "Reflectometer", location: "West sector · Hall D01", status: "online", techniques: ["Reflectometry"], style: "bands", hue: 170, image: "/instruments/estia.png", contact: "Lars Eriksen", description: "Reflectometer with a focusing Selene guide for very small samples and fast kinetics at solid interfaces." },
  { id: "freia", name: "FREIA", title: "Liquids reflectometer", kind: "Reflectometer", location: "West sector · Hall D01", status: "offline", techniques: ["Reflectometry"], style: "bands", hue: 170, image: "/instruments/freia.png", contact: "Dr. Amara Diallo", description: "Horizontal-sample reflectometer for free liquid surfaces, membranes and air–liquid interfaces." },
  { id: "dream", name: "DREAM", title: "Bispectral powder diffractometer", kind: "Diffractometer", location: "South sector · Hall E02", status: "online", techniques: ["Diffraction"], style: "spots", hue: 25, image: "/instruments/dream.png", contact: "Dr. Sofia Marin", description: "High-flux, high-resolution powder diffraction with a bispectral beam, for crystallography, magnetism and in situ chemistry." },
  { id: "heimdal", name: "HEIMDAL", title: "Hybrid diffractometer", kind: "Diffractometer", location: "South sector · Hall E02", status: "maintenance", techniques: ["Diffraction", "SANS"], style: "spots", hue: 25, image: "/instruments/heimdal.png", contact: "Dr. Priya Nair", description: "Combines thermal powder diffraction with SANS and imaging to follow structure across length scales in one experiment." },
  { id: "magic", name: "MAGiC", title: "Magnetism single-crystal diffractometer", kind: "Diffractometer", location: "West sector · Hall D01", status: "maintenance", techniques: ["Single-crystal"], style: "spots", hue: 290, image: "/instruments/magic.png", contact: "Lars Eriksen", description: "Polarised single-crystal diffraction for magnetic structures, with a large detector coverage and extreme sample environments." },
  { id: "nmx", name: "NMX", title: "Macromolecular diffractometer", kind: "Diffractometer", location: "South sector · Hall E02", status: "online", techniques: ["MX"], style: "spots", hue: 140, image: "/instruments/nmx.png", contact: "Dr. Amara Diallo", description: "Macromolecular crystallography with neutrons: hydrogen positions and protonation states in proteins, on robot-positioned detectors." },
  { id: "beer", name: "BEER", title: "Engineering diffractometer", kind: "Diffractometer", location: "West sector · Hall D01", status: "online", techniques: ["Engineering"], style: "spots", hue: 45, image: "/instruments/beer.png", contact: "Dr. Sofia Marin", description: "Engineering diffraction for residual stress, texture and in situ processing of industrial components under load and temperature." },
  { id: "odin", name: "ODIN", title: "Multi-purpose imaging", kind: "Imaging instrument", location: "North sector · Hall D03", status: "online", techniques: ["Imaging", "Diffraction"], style: "micrograph", hue: 330, image: "/instruments/odin.png", contact: "Dr. Priya Nair", description: "Neutron imaging and tomography, including time-of-flight energy-selective and Bragg-edge imaging." },
  { id: "bifrost", name: "BIFROST", title: "Extreme-environment spectrometer", kind: "Spectrometer", location: "West sector · Hall D01", status: "online", techniques: ["Spectroscopy"], style: "spectrum", hue: 220, image: "/instruments/bifrost.png", contact: "Lars Eriksen", description: "Indirect-geometry spectrometer for magnetic and lattice dynamics in small samples under high fields, pressure and low temperature." },
  { id: "cspec", name: "CSPEC", title: "Cold chopper spectrometer", kind: "Spectrometer", location: "West sector · Hall D01", status: "maintenance", techniques: ["Spectroscopy"], style: "spectrum", hue: 220, image: "/instruments/cspec.png", contact: "Dr. Amara Diallo", description: "Cold direct-geometry chopper spectrometer for low-energy excitations and slow dynamics in soft and hard matter." },
  { id: "miracles", name: "MIRACLES", title: "Backscattering spectrometer", kind: "Spectrometer", location: "West sector · Hall D01", status: "maintenance", techniques: ["Backscattering"], style: "spectrum", hue: 85, image: "/instruments/miracles.png", contact: "Dr. Sofia Marin", description: "Backscattering spectrometer with µeV resolution for quasielastic scattering: diffusion, relaxation and tunnelling." },
  { id: "trex", name: "T-REX", title: "Bispectral chopper spectrometer", kind: "Spectrometer", location: "West sector · Hall D01", status: "offline", techniques: ["Spectroscopy"], style: "spectrum", hue: 220, image: "/instruments/trex.png", contact: "Dr. Priya Nair", description: "Thermal–cold chopper spectrometer with polarisation analysis for magnetic excitations and phonons." },
  { id: "vespa", name: "VESPA", title: "Vibrational spectrometer", kind: "Spectrometer", location: "South sector · Hall E02", status: "offline", techniques: ["Vibrational"], style: "spectrum", hue: 350, image: "/instruments/vespa.png", contact: "Lars Eriksen", description: "Vibrational neutron spectroscopy for chemistry, catalysis and hydrogen-containing materials." },
  { id: "tbl", name: "TBL", title: "Test beamline", kind: "Test beamline", location: "North sector · Hall D03", status: "online", techniques: ["Imaging"], style: "micrograph", hue: 330, image: "/instruments/tbl.jpg", contact: "Dr. Amara Diallo", description: "The ESS Test Beamline: first neutrons for detectors, choppers, sample environment and simple imaging setups." },
];
// SciCat's Instrument: pid, uniqueName, name, customMetadata (the flat copy is what the UI reads)
// the instrument drawings sit beside the seed (mock/assets), addressed through the bundler so the base path is handled for us
const DRAWINGS = import.meta.glob<string>("./assets/instruments/*.{png,jpg}", { eager: true, query: "?url", import: "default" });
const drawing = (path?: string) => (path ? DRAWINGS[`./assets/instruments/${path.split("/").pop()}`] : undefined);
// how each instrument's generated pictures are drawn; kept here, not on the instrument
export const ART_OF: Record<string, { style: ThumbStyle; hue: number }> = Object.fromEntries(INSTRUMENT_SEEDS.map((i) => [i.id, { style: i.style, hue: i.hue }]));
export const INSTRUMENTS: Instrument[] = INSTRUMENT_SEEDS.map(({ id, name, style: _style, hue: _hue, ...rest }) => {
  const meta = { ...rest, image: drawing(rest.image) };
  return {
    ...meta,
    pid: id,
    uniqueName: `ess-${id}`,
    name,
    customMetadata: meta,
    createdBy: "admin",
    updatedBy: "admin",
    createdAt: new Date(NOW - 900 * DAY).toISOString(),
    updatedAt: new Date(NOW - int(5, 300) * DAY).toISOString(),
  };
});

interface SampleSeed {
  id: string;
  name: string;
  short: string;
  formula?: string;
  description: string;
  characteristics: Record<string, string>;
  owner: string;
}
const SAMPLE_SEEDS: SampleSeed[] = [
  { id: "s01", name: "Lysozyme crystals, batch 3", short: "lyso3", formula: "C₆₁₃H₉₅₉N₁₉₃O₁₈₅S₁₀", description: "Hen egg-white lysozyme grown by vapour diffusion, tetragonal form.", characteristics: { Concentration: "50 mg/mL", Buffer: "0.1 M NaAc pH 4.5", "Crystal size": "80–120 µm" }, owner: "bio-sax" },
  { id: "s02", name: "LiFePO₄ cathode powder", short: "LFP", formula: "LiFePO₄", description: "Carbon-coated olivine cathode material, pristine and cycled electrodes.", characteristics: { "Particle size": "~200 nm", "Carbon coating": "2 wt%", "Cycles": "0–500" }, owner: "nilsson-mat" },
  { id: "s04", name: "SARS-CoV-2 spike, prefusion", short: "spike", description: "Stabilised prefusion spike trimer, HexaPro variant.", characteristics: { Concentration: "3 mg/mL", Buffer: "20 mM Tris pH 8, 150 mM NaCl", Expression: "HEK293F" }, owner: "bio-sax" },
  { id: "s08", name: "Bi₂Se₃ single crystal", short: "Bi2Se3", formula: "Bi₂Se₃", description: "Bridgman-grown topological insulator, cleaved in situ.", characteristics: { Growth: "Bridgman", Cleave: "in situ, 10⁻¹⁰ mbar", Doping: "Ca 0.5%" }, owner: "vega-physics" },
  { id: "s09", name: "70S ribosome complex", short: "ribo70S", description: "E. coli 70S ribosome with mRNA, tRNAs and macrolide antibiotic.", characteristics: { Concentration: "2 mg/mL", Ligand: "Erythromycin", Buffer: "HEPES pH 7.5" }, owner: "ada-lab" },
  { id: "s11", name: "Collagen type I fibrils", short: "col1", description: "Rat-tail tendon collagen, hydrated and dried states.", characteristics: { Source: "Rat tail tendon", Hydration: "0–100 %RH", Orientation: "Aligned" }, owner: "ada-lab" },
  { id: "s13", name: "Ubiquitin, ¹⁵N-labelled", short: "ubq15N", description: "Uniformly ¹⁵N-labelled human ubiquitin for relaxation dispersion.", characteristics: { Concentration: "1 mM", Label: "U-¹⁵N", Buffer: "50 mM phosphate pH 6.5" }, owner: "ada-lab" },
];

const PEOPLE = ["Dr. Sofia Marin", "Dr. Priya Nair", "Lars Eriksen", "Dr. Amara Diallo"];

const GROUPS: [string, string][] = [
  ["bio-sax", "Dr. Ada Okafor"], ["ada-lab", "Dr. Ada Okafor"], ["nilsson-mat", "Dr. Henrik Nilsson"], ["vega-physics", "Prof. Lucía Vega"],
  ["tanaka-lab", "Dr. Mei Tanaka"], ["haddad-lab", "Prof. Omar Haddad"], ["petrova-lab", "Dr. Elena Petrova"], ["weber-lab", "Dr. Jonas Weber"],
  ["rahman-lab", "Prof. Aisha Rahman"], ["ruiz-lab", "Dr. Tomás Ruiz"],
];


// Which techniques suit a sample, and the words people search it by.
const SAMPLE_TECH: Record<string, string[]> = { s01: ["MX", "SANS"], s02: ["Diffraction", "Imaging"], s04: ["SANS"], s08: ["Single-crystal", "Spectroscopy"], s09: ["SANS", "Backscattering"], s11: ["SANS", "Reflectometry"], s13: ["Backscattering", "Spectroscopy"] };
const EXTRA_KEYWORDS: Record<string, string[]> = {};

// Sample families: name stems, suited techniques, keywords and the traits a sample of that kind lists.
interface Family {
  stems: string[];
  techniques: string[];
  keywords: string[];
  traits: Record<string, string[]>;
}
const FAMILIES: Family[] = [
  { stems: ["Thaumatin", "Insulin", "Proteinase K", "Trypsin", "Glucose isomerase", "Myoglobin", "Ferritin", "Streptavidin"], techniques: ["MX", "SANS"], keywords: ["protein", "crystallography", "deuterated"], traits: { Concentration: ["10 mg/mL", "25 mg/mL", "40 mg/mL"], Buffer: ["0.1 M HEPES pH 7.5", "0.1 M Tris pH 8", "0.1 M NaAc pH 4.6"], "Crystal size": ["40–60 µm", "80–120 µm", "150–200 µm"] } },
  { stems: ["NMC811 cathode", "LTO anode", "Graphite anode", "LiCoO₂ cathode", "Na₃V₂(PO₄)₃ cathode", "Si–C composite anode", "LLZO electrolyte"], techniques: ["Diffraction", "Imaging", "Engineering"], keywords: ["battery", "electrode", "operando"], traits: { "Particle size": ["~150 nm", "~1 µm", "5–10 µm"], Cycles: ["0", "0–100", "0–500"], Loading: ["4 mg/cm²", "8 mg/cm²"] } },
  { stems: ["Graphene on SiC", "MoS₂ monolayer", "WTe₂ flake", "Sr₂RuO₄ crystal", "FeSe film", "Cd₃As₂ crystal", "NbSe₂ flake"], techniques: ["Single-crystal", "Spectroscopy", "Diffraction"], keywords: ["quantum material", "magnetism"], traits: { Thickness: ["monolayer", "3 layers", "bulk"], Substrate: ["SiC", "SrTiO₃", "sapphire"], Cleaved: ["in situ", "ex situ"] } },
  { stems: ["Silk fibroin film", "Cellulose nanofibrils", "PLA scaffold", "Chitosan hydrogel", "Keratin fibres", "Elastin-like polymer"], techniques: ["SANS", "Reflectometry", "Backscattering"], keywords: ["biomaterials", "polymer", "hierarchical structure"], traits: { Hydration: ["dry", "50 %RH", "fully hydrated"], Porosity: ["12 %", "35 %", "60 %"], Source: ["recombinant", "natural"] } },
  { stems: ["Pt/C catalyst", "ZSM-5 zeolite", "UiO-66 MOF", "Cu/ZnO/Al₂O₃ catalyst", "Pd nanoparticles", "Co₃O₄ spinel", "CeO₂ nanorods"], techniques: ["Diffraction", "Vibrational", "Spectroscopy"], keywords: ["catalyst", "in situ", "hydrogen"], traits: { Loading: ["1 wt%", "5 wt%", "20 wt%"], "Particle size": ["2 nm", "5 nm", "12 nm"], Support: ["carbon", "alumina", "silica"] } },
  { stems: ["Ti-6Al-4V lattice", "Inconel 718 weld", "AlSi10Mg print", "Mg alloy stent", "Steel fatigue coupon", "Cu–Nb composite"], techniques: ["Engineering", "Imaging", "Diffraction"], keywords: ["alloy", "residual stress", "microstructure"], traits: { Process: ["laser powder bed", "cast", "wrought"], Porosity: ["0.2 %", "1.1 %", "3 %"], "Heat treatment": ["as-built", "annealed", "HIP"] } },
  { stems: ["Adenovirus capsid", "AAV9 vector", "Influenza HA trimer", "Phage T4 tail", "Norovirus VLP", "GroEL chaperonin", "Apoferritin"], techniques: ["SANS"], keywords: ["virus", "structural biology", "contrast variation"], traits: { Concentration: ["0.5 mg/mL", "2 mg/mL", "5 mg/mL"], Grid: ["UltrAuFoil 1.2/1.3", "Quantifoil 2/1"], Vitrification: ["Vitrobot 4 °C", "Vitrobot 20 °C"] } },
  { stems: ["Calmodulin, ¹³C/¹⁵N", "SH3 domain, ¹⁵N", "α-synuclein, ¹⁵N", "GB1, ²H/¹⁵N", "Ubiquitin K48 dimer", "Amyloid-β fibrils"], techniques: ["Backscattering", "Spectroscopy", "SANS"], keywords: ["protein dynamics", "quasielastic"], traits: { Concentration: ["0.3 mM", "0.8 mM", "1.2 mM"], Label: ["U-¹⁵N", "U-¹³C/¹⁵N", "²H/¹³C/¹⁵N"], Buffer: ["20 mM phosphate pH 6.5", "50 mM MES pH 6"] } },
];
// A hundred more samples from the families above, later ones as further batches of the same material.
for (let i = 0; i < 100; i++) {
  const fam = FAMILIES[i % FAMILIES.length];
  const nth = Math.floor(i / FAMILIES.length);
  const stem = fam.stems[nth % fam.stems.length];
  const batch = Math.floor(nth / fam.stems.length) + 1;
  const id = `s${100 + i}`;
  const characteristics = Object.fromEntries(Object.entries(fam.traits).map(([k, vs]) => [k, pick(vs)]));
  SAMPLE_SEEDS.push({
    id,
    name: batch > 1 ? `${stem}, batch ${batch}` : stem,
    short: `${stem.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6)}${batch > 1 ? batch : ""}`,
    description: `${stem} prepared for ${fam.techniques[0]}; ${Object.entries(characteristics).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(", ")}.`,
    characteristics,
    owner: pick(GROUPS)[0],
  });
  SAMPLE_TECH[id] = fam.techniques;
  EXTRA_KEYWORDS[id] = fam.keywords;
}

// Fuller, grouped metadata for every sample: how it was made, how it is kept, where it came from.
const PREP_PEOPLE = ["Dr. Sofia Marin", "Dr. Priya Nair", "Lars Eriksen", "Dr. Amara Diallo", "Dr. Mei Tanaka", "Dr. Jonas Weber"];
const SUPPLIERS = ["Sigma-Aldrich", "Hampton Research", "MilliporeSigma", "Goodfellow", "In-house synthesis", "Alfa Aesar", "Cambridge Isotope Labs"];
function sampleGroups(s: SampleSeed): Record<string, Record<string, string>> {
  const bio = /protein|crystal|virus|ribosome|spike|capsid|ubiquitin|collagen|synuclein|calmodulin/i.test(`${s.name} ${s.description}`);
  const day = (back: number) => new Date(NOW - back * DAY).toISOString().slice(0, 10);
  return {
    Preparation: {
      "Prepared on": day(int(20, 900)),
      "Prepared by": pick(PREP_PEOPLE),
      Method: bio ? pick(["Vapour diffusion", "Size-exclusion purification", "Affinity purification", "Dialysis into D₂O buffer"]) : pick(["Solid-state synthesis", "Spin coating", "Ball milling", "Chemical vapour deposition", "Casting"]),
      "Batch ID": `B${int(100, 999)}-${String.fromCharCode(65 + int(0, 5))}`,
      Deuteration: bio ? pick(["Perdeuterated", "Partially deuterated", "None"]) : "Not applicable",
    },
    "Storage and safety": {
      Storage: bio ? pick(["−80 °C", "−20 °C", "4 °C"]) : pick(["Room temperature, dry", "Glovebox (Ar)", "Desiccator"]),
      "Hazard class": bio ? pick(["Biosafety level 1", "Biosafety level 2"]) : pick(["None", "Irritant", "Air-sensitive"]),
      "Shelf life": pick(["3 months", "6 months", "12 months", "24 months"]),
      Container: pick(["Quartz capillary", "Aluminium can", "Banjo cell", "Vanadium can", "Cryo-vial"]),
    },
    Provenance: {
      Supplier: pick(SUPPLIERS),
      "Lot number": `LOT-${int(10000, 99999)}`,
      "Registered at ESS": day(int(5, 400)),
      "Sample group": s.owner,
    },
  };
}
const SAMPLE_GROUPS = new Map(SAMPLE_SEEDS.map((sm) => [sm.id, sampleGroups(sm)]));
export const SAMPLES: Sample[] = SAMPLE_SEEDS.map((sm) => {
  const created = new Date(NOW - int(20, 900) * DAY).toISOString();
  const bio = /protein|crystal|virus|ribosome|spike|capsid|ubiquitin|collagen|synuclein|calmodulin/i.test(`${sm.name} ${sm.description}`);
  return {
    sampleId: sm.id,
    sampleName: sm.name,
    description: sm.description,
    owner: GROUPS.find((g) => g[0] === sm.owner)?.[1] ?? pick(PEOPLE),
    type: bio ? "biological" : "material",
    sampleCharacteristics: sm.characteristics,
    ownerGroup: sm.owner,
    accessGroups: [sm.owner],
    isPublished: false,
    createdBy: "ingestor",
    updatedBy: "ingestor",
    createdAt: created,
    updatedAt: created,
    short: sm.short,
    formula: sm.formula,
    groups: SAMPLE_GROUPS.get(sm.id),
  };
});

type PropSeed = [string, string, string, string, string, string[], string[], number, number];
const PROPOSAL_SEEDS: PropSeed[] = [
  ["20240311", "Pressure-induced conformational dynamics of lysozyme", "SANS on LoKI under hydrostatic pressure to 400 MPa, with NMX crystallography of the same batches to locate hydrogen positions.", "Dr. Ada Okafor", "bio-sax", ["s01"], ["nmx", "loki"], 500, 70],
  ["20240587", "Solution structure of prefusion spike variants", "Contrast-variation SANS of deuterated spike trimers to map glycan shielding and antibody binding in solution.", "Dr. Ada Okafor", "bio-sax", ["s04", "s09"], ["skadi"], 420, 90],
  ["20240933", "Lithium-ion cathode degradation across 500 cycles", "Operando neutron diffraction on DREAM and tomography on ODIN of LiFePO₄ cells to follow lithiation and capacity fade.", "Dr. Henrik Nilsson", "nilsson-mat", ["s02"], ["loki"], 330, 120],
  ["20241150", "Magnetic order and spin excitations in doped Bi₂Se₃", "Single-crystal diffraction on MAGiC and inelastic scattering on BIFROST of magnetically doped Bi₂Se₃.", "Prof. Lucía Vega", "vega-physics", ["s08"], ["magic", "bifrost"], 270, 45],
  ["20250102", "Ribosome–antibiotic complexes in solution", "SANS on LoKI and quasielastic scattering on MIRACLES of 70S complexes with macrolide variants.", "Dr. Ada Okafor", "ada-lab", ["s09", "s13"], ["loki", "miracles"], 240, 80],
  ["20250334", "Collagen fibril hierarchy by SANS and reflectometry", "SANS and ESTIA reflectometry of tendon-derived collagen across hydration states.", "Dr. Ada Okafor", "ada-lab", ["s11", "s13"], ["loki", "estia"], 170, 65],
];

// A facility has far more proposals than the handful above: a long tail, each with only one or two datasets to keep the seed small.
const LIGHT = new Set<string>();
{
  // titles and abstracts read like the ones on facility proposals and data records, by technique
  const TITLES: Record<string, ((m: string) => string)[]> = {
    SANS: [(m) => `Nanoscale structure of ${m} in solution by contrast-variation SANS`, (m) => `Self-assembly and aggregation of ${m} under shear`, (m) => `Temperature-dependent conformations of ${m}`, (m) => `Contrast-matched SANS of ${m} complexes`],
    Reflectometry: [(m) => `Interfacial structure of ${m} at the solid–liquid boundary`, (m) => `Adsorption and layer growth of ${m} studied by neutron reflectometry`, (m) => `Depth profile of ${m} films during swelling`, (m) => `Kinetics of ${m} at the air–water interface`],
    Diffraction: [(m) => `Crystal and magnetic structure of ${m} across the phase transition`, (m) => `Operando neutron diffraction of ${m}`, (m) => `Phase evolution of ${m} on heating`, (m) => `Light-atom positions and disorder in ${m}`],
    "Single-crystal": [(m) => `Modulations of the long-range magnetic order in ${m}`, (m) => `Magnetic structure of ${m} in applied field`, (m) => `Diffuse scattering and short-range order in ${m}`, (m) => `Polarised single-crystal diffraction of ${m}`],
    MX: [(m) => `Hydrogen and protonation states in ${m}`, (m) => `Room-temperature neutron structure of ${m} with a bound ligand`, (m) => `Water network of ${m} by neutron crystallography`, (m) => `Perdeuterated ${m}: locating mobile protons`],
    Engineering: [(m) => `Residual stress mapping in ${m}`, (m) => `In situ loading of ${m}: lattice strain evolution`, (m) => `Phase fractions and texture in ${m} after heat treatment`, (m) => `Fatigue damage in ${m} by neutron diffraction`],
    Imaging: [(m) => `Time-resolved neutron tomography of ${m}`, (m) => `Water and hydrogen distribution in ${m}`, (m) => `Bragg-edge imaging of ${m} during processing`, (m) => `Energy-selective radiography of ${m}`],
    Spectroscopy: [(m) => `Spin excitations in ${m}`, (m) => `Phonon dispersion of ${m} under pressure`, (m) => `Crystal-field levels and magnetic excitations of ${m}`, (m) => `Low-energy dynamics of ${m} near the transition`],
    Backscattering: [(m) => `Hydration-dependent dynamics of ${m}`, (m) => `Quasielastic scattering from ${m}: diffusion and relaxation`, (m) => `Confined water in ${m}`, (m) => `Protein–solvent coupling in ${m}`],
    Vibrational: [(m) => `Hydrogen bonding in ${m} by inelastic neutron scattering`, (m) => `Adsorbed hydrogen on ${m}`, (m) => `Vibrational spectra of ${m} for catalysis`, (m) => `Librational modes of ${m}`],
  };
  const ABSTRACTS: Record<string, ((m: string, i: string) => string)[]> = {
    SANS: [(m, i) => `We will use ${i} to follow the structure of ${m} over a wide q range. Samples are prepared in H₂O/D₂O mixtures to vary the contrast; results are compared with form-factor models and complementary light scattering.`, (m, i) => `Small-angle scattering on ${i} will determine size, shape and interactions of ${m} as a function of concentration and temperature, to relate local structure to macroscopic behaviour.`],
    Reflectometry: [(m, i) => `Specular reflectivity measured on ${i} will resolve the thickness, roughness and composition of ${m} layers with sub-nanometre resolution, using isotopic contrast to locate each component.`, (m, i) => `${i} gives the time resolution to follow ${m} during in situ changes of solvent and temperature; layer models are refined against the full set of curves.`],
    Diffraction: [(m, i) => `Powder diffraction on ${i} will refine the nuclear and magnetic structure of ${m} between 2 K and room temperature, locating light atoms that X-rays cannot see.`, (m, i) => `We propose in situ measurements of ${m} on ${i} during heating and cycling, with Rietveld refinement of phase fractions, lattice parameters and site occupancies.`],
    "Single-crystal": [(m, i) => `Single-crystal diffraction on ${i} will determine the magnetic propagation vector and moment directions of ${m}, in zero field and up to 10 T.`, (m, i) => `A large crystal of ${m} will be mapped on ${i} to collect Bragg and diffuse intensity in a single setting, supporting a full structure refinement.`],
    MX: [(m, i) => `Neutron Laue data on ${i} from a deuterated crystal of ${m} will locate hydrogen atoms and protonation states that are invisible to X-rays, linking them to function.`, (m, i) => `Room-temperature data collection on ${i} for ${m} with and without ligand, to compare hydrogen-bond networks around the active site.`],
    Engineering: [(m, i) => `Strain scanning on ${i} will map lattice strain in ${m} in the as-built and heat-treated states and compare it with finite-element predictions.`, (m, i) => `${m} will be loaded in situ on ${i} while diffraction patterns follow lattice strain, texture and phase fractions through yield and failure.`],
    Imaging: [(m, i) => `Tomography on ${i} will image the three-dimensional distribution of hydrogen-rich phases in ${m}, with energy-resolved data to separate crystalline phases.`, (m, i) => `Time-resolved radiography of ${m} on ${i}, with exposure times of seconds, to follow transport and phase change during operation.`],
    Spectroscopy: [(m, i) => `Inelastic scattering on ${i} will measure the dispersion of the excitations of ${m} along high-symmetry directions, at several incident energies and temperatures.`, (m, i) => `We will map S(Q,ω) of ${m} on ${i} across the ordering temperature to follow the softening and damping of the low-energy modes.`],
    Backscattering: [(m, i) => `Quasielastic scattering on ${i} will separate translational and rotational motions in ${m} as a function of hydration, over time scales from 10 ps to 1 ns.`, (m, i) => `${i} gives µeV resolution to measure the diffusion of ${m} in H₂O and D₂O and to extract the elastic incoherent structure factor.`],
    Vibrational: [(m, i) => `The vibrational spectrum of ${m} measured on ${i} over 0–4000 cm⁻¹ will assign hydrogen modes and test DFT calculations of the local environment.`, (m, i) => `Inelastic scattering on ${i} will follow the librational and stretching modes of ${m} before and after loading, with no optical selection rules.`],
  };
  for (let i = 0; i < 104; i++) {
    const [group, pi] = i % 5 === 0 ? pick(GROUPS.slice(0, 2)) : pick(GROUPS.slice(2));
    const sample = pick(SAMPLE_SEEDS);
    const fits = INSTRUMENTS.filter((x) => x.techniques.some((t) => SAMPLE_TECH[sample.id].includes(t)));
    const inst = fits.length ? pick(fits) : pick(INSTRUMENTS);
    // about one proposal in three books a second instrument
    const second = i % 3 === 1 ? (fits.filter((x) => x.pid !== inst.pid).length ? pick(fits.filter((x) => x.pid !== inst.pid)) : pick(INSTRUMENTS.filter((x) => x.pid !== inst.pid))) : undefined;
    const insts = second ? [inst, second] : [inst];
    const ago = int(40, 2000);
    const id = `${new Date(NOW - ago * DAY).getFullYear()}${String(2000 + i)}`;
    LIGHT.add(id);
    const tech = inst.techniques[0];
    const material = sample.name.split(",")[0];
    PROPOSAL_SEEDS.push([id, pick(TITLES[tech] ?? TITLES.SANS)(material), pick(ABSTRACTS[tech] ?? ABSTRACTS.SANS)(material, insts.map((x) => x.name).join(" and ")), pi, group, [sample.id], insts.map((x) => x.pid), ago, int(20, 120)]);
  }
}

const LOCAL_CONTACTS = ["Zoë Fisher", "Dr. Marc Lindqvist", "Dr. Tamás Kovács", "Ines Moreau"];
const AFFILIATIONS = ["European Spallation Source ERIC (ESS)", "Lund University", "Technical University of Denmark", "Uppsala University", "Institut Laue-Langevin"];
const mv = (human_name: string, value: string | number) => ({ human_name, value });
const orcidOf = () => `0000-000${int(1, 4)}-${int(1000, 9999)}-${int(1000, 9999)}`;
const KEYWORD_POOL = ["WF_00_00", "WF_01_04", "WF_02_01", "calibration", "commissioning", "user programme", "standard sample"];

export const PROPOSALS: Proposal[] = PROPOSAL_SEEDS.map(([id, title, abstract, pi, group, sampleIds, instrumentIds, ago, dur]) => {
  const start = new Date(NOW - ago * DAY);
  const end = new Date(start.getTime() + dur * DAY);
  const team = [pi, ...shuffle(PEOPLE).slice(0, 2)];
  const proposer = chance(0.35) ? team[1] : pi;
  const [first, ...rest] = pi.replace(/^(Dr\.|Prof\.)\s+/, "").split(" ");
  const [pFirst, ...pRest] = proposer.replace(/^(Dr\.|Prof\.)\s+/, "").split(" ");
  const contact = pick(LOCAL_CONTACTS);
  const [cFirst, ...cRest] = contact.replace(/^(Dr\.|Prof\.)\s+/, "").split(" ");
  const finished = end.getTime() < NOW;
  // beam time is booked in one to three blocks inside the proposal's period
  const blocks = int(1, 3);
  const MeasurementPeriodList = Array.from({ length: blocks }, (_, b) => {
    const from = new Date(start.getTime() + Math.floor((b * dur) / blocks) * DAY);
    return { instrument: pick(instrumentIds), start: from.toISOString(), end: new Date(from.getTime() + Math.max(2, Math.floor(dur / blocks / 2)) * DAY).toISOString(), comment: b === 0 ? "" : pick(["", "", "Follow-up block", "Sample environment change"]) };
  });
  return {
    proposalId: id, title, abstract,
    pi, pi_email: emailOf(pi), pi_firstname: first, pi_lastname: rest.join(" "),
    email: emailOf(proposer), firstname: pFirst, lastname: pRest.join(" "),
    ownerGroup: group, sampleIds, instrumentIds,
    team,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    type: "Default Proposal",
    parentProposalId: null,
    accessGroups: chance(0.4) ? [id, group] : [id],
    instrumentGroup: instrumentIds[0],
    createdBy: "proposalIngestor",
    updatedBy: "ingestor",
    createdAt: new Date(start.getTime() - int(20, 90) * DAY).toISOString(),
    updatedAt: new Date(Math.min(NOW, start.getTime() + int(1, dur) * DAY)).toISOString(),
    isPublished: false,
    MeasurementPeriodList,
    keywords: shuffle(KEYWORD_POOL).slice(0, int(1, 3)),
    metadata: {
      status_proposal: mv("UOS Proposal Status", finished ? "COMPLETED" : "ALLOCATED"),
      pi_firstname: mv("PI First Name", first),
      pi_lastname: mv("PI Last Name", rest.join(" ")),
      pi_email: mv("PI Email", emailOf(pi)),
      pi_orcid: mv("PI ORCID", orcidOf()),
      pi_affiliation: mv("PI Affiliation", pick(AFFILIATIONS)),
      instrument_name: mv("Instrument Name", INSTRUMENTS.find((x) => x.pid === instrumentIds[0])?.name ?? ""),
      local_contact_firstname: mv("Local contact name", cFirst),
      local_contact_lastname: mv("Local contact surname", cRest.join(" ")),
      local_contact_email: mv("Local contact email", emailOf(contact)),
      number_of_visitors: mv("Number of Visitors", int(0, 4)),
    },
  };
});
// about a third are experiments: type "Experiment", numbered after the proposal of the same group they belong to ("544555-1")
{
  const lastOf = new Map<string, (typeof PROPOSALS)[number]>();
  const counter = new Map<string, number>();
  PROPOSALS.forEach((p, i) => {
    const parent = lastOf.get(p.ownerGroup);
    if (i % 3 !== 0 && parent && LIGHT.has(p.proposalId) && i % 2 === 1) {
      const n = (counter.get(parent.proposalId) ?? 0) + 1;
      counter.set(parent.proposalId, n);
      LIGHT.delete(p.proposalId);
      p.type = "Experiment";
      p.parentProposalId = parent.proposalId;
      p.proposalId = `${parent.proposalId}-${n}`;
      LIGHT.add(p.proposalId);
      p.title = `${p.title} - ${p.proposalId}`;
      p.abstract = `Experiment ${p.proposalId}\n${p.abstract}`;
      p.accessGroups = [parent.proposalId];
      p.metadata.status_experiment = mv("UOS Experiment Status", new Date(p.endTime).getTime() < NOW ? "COMPLETED" : "ACTIVE");
      if (chance(0.3)) {
        p.isPublished = true;
        p.metadata.published_data_doi = mv("Published Data DOI", `10.17199/${int(10000000, 99999999)}-${int(1000, 9999)}`);
        p.metadata.embargo_end_date = mv("Embargo end date", new Date(new Date(p.endTime).getTime() + 365 * DAY).toISOString());
      }
    } else {
      lastOf.set(p.ownerGroup, p);
      // some proposals are public too
      if (LIGHT.has(p.proposalId) && chance(0.15)) p.isPublished = true;
    }
  });
}

const SAMPLE_KEYWORDS: Record<string, string[]> = {
  ...EXTRA_KEYWORDS,
  s01: ["protein", "crystallography", "pressure"], s02: ["battery", "cathode", "operando"], s04: ["virus", "structural biology", "antibody"],
  s08: ["topological insulator", "electronic structure"], s09: ["ribosome", "antibiotics", "structural biology"],
  s11: ["biomaterials", "fibrils", "hierarchical structure"], s13: ["protein NMR", "dynamics"],
};

const TECH_LONG: Record<string, string> = {
  SANS: "Small-angle neutron scattering", Reflectometry: "Neutron reflectometry", Diffraction: "Neutron powder diffraction", "Single-crystal": "Single-crystal neutron diffraction",
  MX: "Macromolecular neutron crystallography", Engineering: "Engineering neutron diffraction", Imaging: "Neutron imaging", Spectroscopy: "Inelastic neutron scattering",
  Backscattering: "Quasielastic neutron backscattering", Vibrational: "Vibrational neutron spectroscopy",
};
const CONDITIONS = ["room temperature", "4 K", "pH 4.5", "dry state", "in D₂O", "cycle 25", "annealed", "as-prepared", "600 °C", "9 T field"];
const NOTES = [
  "Beam stable throughout; no radiation damage observed.", "Repeat of earlier run with improved alignment.", "Measured during night shift, standard calibration applied.",
  "Includes background and empty-cell reference frames.", "Signal-to-noise lower than expected; see logbook.", "Part of the temperature series, see related datasets.",
];
const DERIVED_SUFFIX = ["reduced", "integrated", "refined", "azimuthal", "aligned", "analysis"];

const M = (group: string, value: MetaValue["value"], unit?: string): MetaValue => ({ value, unit, group });
// the same key arrives in different units from different beamlines
const temp = (K: number) => (chance(0.25) ? M("Sample environment", +(K - 273.15).toFixed(1), "°C") : M("Sample environment", K, "K"));

// Metadata follows the technique, so every instrument of a kind records the same keys.
// Metadata follows the technique, so every instrument of a kind records the same keys. ESS runs at 14 Hz with a 2.86 ms pulse.
function genMeta(tech: string): Record<string, MetaValue> {
  const T = flt(2, 320, 1);
  const source = { proton_charge: M("Source", flt(20, 1800, 0), "µAh"), source_frequency: M("Source", 14, "Hz") };
  switch (tech) {
    case "SANS":
      return { ...source, wavelength_band: M("Beam", pick(["3–11.5", "2–14", "4–10"]), "Å"), detector_distance: M("Detector", pick([1.5, 5, 10, 20]), "m"), sample_temperature: temp(T), contrast: M("Sample environment", pick(["H₂O", "D₂O", "42 % D₂O", "65 % D₂O"])) };
    case "Reflectometry":
      return { ...source, angle_of_incidence: M("Beam", flt(0.3, 3.5, 2), "°"), wavelength_band: M("Beam", pick(["4–10", "3–12"]), "Å"), q_max: M("Beam", flt(0.2, 0.5, 2), "Å⁻¹"), interface: M("Sample environment", pick(["air–liquid", "solid–liquid", "air–solid"])), sample_temperature: temp(T) };
    case "Diffraction":
      return { ...source, wavelength_band: M("Beam", pick(["0.8–2.5", "1.2–4.8"]), "Å"), chopper_frequency: M("Beam", pick([14, 56, 112, 168, 336]), "Hz"), sample_temperature: temp(T), magnetic_field: M("Sample environment", pick([0, 0, 2, 5, 9]), "T") };
    case "Single-crystal":
      return { ...source, wavelength_band: M("Beam", pick(["0.8–3", "1.5–6"]), "Å"), polarised: M("Beam", chance(0.5)), sample_temperature: temp(T), magnetic_field: M("Sample environment", pick([0, 1, 5, 10]), "T"), pressure: M("Sample environment", pick([0, 0, 0.5, 2]), "GPa") };
    case "MX":
      return { ...source, wavelength_band: M("Beam", "1.8–3.5", "Å"), unit_cell_a: M("Sample", flt(40, 160, 1), "Å"), crystal_volume: M("Sample", flt(0.05, 2, 2), "mm³"), deuteration: M("Sample", pick(["perdeuterated", "H/D exchanged", "hydrogenated"])), sample_temperature: temp(T) };
    case "Engineering":
      return { ...source, applied_load: M("Sample environment", int(0, 50), "kN"), gauge_volume: M("Beam", pick([1, 8, 27]), "mm³"), sample_temperature: temp(flt(290, 1200, 0)), strain_direction: M("Sample", pick(["axial", "radial", "hoop"])) };
    case "Imaging":
      return { ...source, pixel_size: M("Detector", pick([13, 25, 55, 100]), "µm"), projections: M("Acquisition", pick([600, 900, 1800])), exposure_time: M("Acquisition", flt(1, 30, 0), "s"), wavelength_band: M("Beam", pick(["2–6", "3–8", "white beam"]), "Å"), bragg_edge: M("Acquisition", chance(0.3)) };
    case "Spectroscopy":
      return { ...source, incident_energy: M("Beam", pick([2.5, 5, 10, 20, 40, 80]), "meV"), energy_resolution: M("Beam", flt(30, 400, 0), "µeV"), sample_temperature: temp(T), magnetic_field: M("Sample environment", pick([0, 0, 3, 9, 14]), "T") };
    case "Backscattering":
      return { ...source, energy_resolution: M("Beam", pick([2, 5, 20]), "µeV"), energy_window: M("Beam", pick([0.3, 1, 2]), "meV"), sample_temperature: temp(T), hydration: M("Sample environment", pick(["dry", "0.4 g/g", "solution"])) };
    default:
      return { ...source, energy_range: M("Beam", pick(["0–500", "0–1000"]), "meV"), sample_temperature: temp(flt(5, 300, 1)), sample_mass: M("Sample", flt(0.2, 5, 2), "g") };
  }
}

const SIZE_GB: Record<string, [number, number, number, number]> = {
  SANS: [0.5, 20, 100, 3000], Reflectometry: [0.2, 10, 50, 1500], Diffraction: [1, 40, 200, 5000], "Single-crystal": [2, 60, 300, 6000], MX: [5, 80, 500, 8000],
  Engineering: [1, 30, 200, 4000], Imaging: [50, 900, 1000, 8000], Spectroscopy: [5, 150, 500, 10000], Backscattering: [1, 40, 200, 4000], Vibrational: [0.5, 15, 100, 2000],
};

// SciCat's lifecycle for each place a dataset can be; the UI reads it back as online / archived / retrieving (see `storageOf`)
export function lifecycleFor(s: Storage, created: string): DatasetLifecycle {
  const base = { dateOfDiskPurging: undefined, archiveRetentionTime: new Date(new Date(created).getTime() + 10 * 365 * DAY).toISOString(), storageLocation: "ESS-Tape-Lund" };
  if (s === "online") return { ...base, archivable: true, retrievable: false, publishable: false, isOnCentralDisk: true, archiveStatusMessage: "datasetCreated", retrieveStatusMessage: "" };
  if (s === "retrieving") return { ...base, archivable: false, retrievable: false, publishable: true, isOnCentralDisk: false, archiveStatusMessage: "datasetOnArchiveDisk", retrieveStatusMessage: "scheduleRetrieveJob" };
  return { ...base, archivable: false, retrievable: true, publishable: true, isOnCentralDisk: false, archiveStatusMessage: "datasetOnArchiveDisk", retrieveStatusMessage: "" };
}
export function setStorage(d: Dataset, s: Storage) {
  d.datasetlifecycle = { ...lifecycleFor(s, d.creationTime), publishedOn: d.datasetlifecycle.publishedOn, dateOfPublishing: d.datasetlifecycle.dateOfPublishing };
  d.packedSize = s === "online" ? 0 : Math.round(d.size * 0.93);
  d.numberOfFilesArchived = s === "online" ? 0 : d.numberOfFiles;
}

const techniqueOf = (name: string): Technique => ({ pid: `technique:${name.toLowerCase().replace(/[^a-z]+/g, "-")}`, name });
// what the files of a reduced dataset are in, by technique
const DERIVED_FORMAT: Record<string, string> = { SANS: "NXcanSAS (HDF5)", Reflectometry: "ORSO reflectivity (.ort)", Diffraction: "xye (ASCII)", Engineering: "xye (ASCII)", Imaging: "TIFF stack", "Single-crystal": "HKL list (ASCII)", MX: "HKL list (ASCII)", Spectroscopy: "NXspe (HDF5)", Backscattering: "NXspe (HDF5)", Vibrational: "NXspe (HDF5)" };
const REDUCTION_SOFTWARE = ["https://github.com/scipp/esssans v24.12.0", "https://github.com/scipp/essreduce v25.1.0", "https://github.com/scipp/essdiffraction v25.2.0", "https://github.com/mantidproject/mantid v6.11.0"];
// a facility file name: the instrument and an eight-digit run, as at ISIS ("SANS2D00055132") and ESS
const runCode = (inst: Instrument, run: string) => `${inst.name.toUpperCase().replace(/[^A-Z0-9]/g, "")}${run}`;

interface Draft {
  tmpId: number;
  srcTmp?: number;
  derived: boolean;
  p: Proposal;
  inst: Instrument;
  sample: Sample;
  tech: string;
  t: number;
  cond: string;
  size: number;
  files: number;
  keywords: string[];
  meta: Record<string, MetaValue>;
  thumbSeed: number;
  thumbHue: number;
  acq: number;
}

const drafts: Draft[] = [];
let tmp = 0;
for (const p of PROPOSALS) {
  const n = LIGHT.has(p.proposalId) ? int(1, 2) : int(8, 14);
  const rawCount = Math.round(n * 0.86);
  const raws: Draft[] = [];
  for (let i = 0; i < n; i++) {
    const derived = i >= rawCount;
    const src = derived ? pick(raws) : undefined;
    const instId = pick(p.instrumentIds);
    const sampleId = pick(p.sampleIds);
    const inst = src ? src.inst : INSTRUMENTS.find((x) => x.pid === instId)!;
    const sample = src ? src.sample : SAMPLES.find((x) => x.sampleId === sampleId)!;
    const tech = src ? src.tech : pick(inst.techniques);
    const start = new Date(p.startTime).getTime();
    const dur = new Date(p.endTime).getTime() - start;
    let t = src ? src.t + int(1, 10) * DAY : start + rnd() * dur;
    t = Math.min(t, NOW - int(2, 60) * 3600000);
    const [lo, hi, flo, fhi] = SIZE_GB[tech] ?? [1, 10, 10, 1000];
    const f = derived ? 0.03 : 1;
    const d: Draft = {
      tmpId: tmp++, srcTmp: src?.tmpId, derived, p, inst, sample, tech, t,
      cond: src ? CONDITIONS[0] : pick(CONDITIONS),
      size: Math.round(flt(lo, hi, 2) * GB * f),
      files: Math.max(1, Math.round(int(flo, fhi) * (derived ? 0.02 : 1))),
      keywords: [tech.toLowerCase(), ...shuffle(SAMPLE_KEYWORDS[sample.sampleId] ?? []).slice(0, 2)],
      meta: genMeta(tech),
      thumbSeed: int(1, 99999),
      thumbHue: ART_OF[inst.pid].hue + int(-10, 10),
      acq: int(12, 420) * 60000,
    };
    if (!derived) raws.push(d);
    drafts.push(d);
  }
}

drafts.sort((a, b) => a.t - b.t);
const pidOf = new Map<number, string>();
drafts.forEach((d, i) => pidOf.set(d.tmpId, `MDC-${new Date(d.t).getFullYear() % 100}-${String(i + 1).padStart(5, "0")}`));

let evId = 0;
const ev = (at: string, kind: HistoryEvent["kind"], actor: string, text: string): HistoryEvent => ({ id: `e${evId++}`, at, kind, actor, text });
const addDays = (iso: string, d: number) => new Date(Math.min(new Date(iso).getTime() + d * DAY, NOW)).toISOString();

// run numbers climb with time on each instrument, as they do at a facility
const runOf = new Map<string, number>();
const done = new Map<number, Dataset>();
export const datasets: SeedDataset[] = drafts.map((d) => {
  const { p, inst, sample, tech } = d;
  const src = d.srcTmp !== undefined ? done.get(d.srcTmp)! : undefined;
  const n = (runOf.get(inst.pid) ?? int(4000, 60000)) + (src ? 0 : int(1, 28));
  if (!src) runOf.set(inst.pid, n);
  const runNumber = src ? src.runNumber : String(n).padStart(8, "0");
  const datasetName = src ? `${src.datasetName}_${pick(DERIVED_SUFFIX)}` : runCode(inst, runNumber);
  const creation = new Date(d.t).toISOString();
  const endTime = new Date(d.t - int(1, 9) * 60000).toISOString();
  const startTime = new Date(d.t - d.acq).toISOString();
  const mine = SEED_USER.groups.includes(p.ownerGroup);
  const sharedWith = !mine && p.proposalId === "20240933" && chance(0.55) ? ["ada-lab"] : mine && chance(0.15) ? ["kovacs-lab"] : [];
  const orcid = String(p.metadata.pi_orcid?.value ?? "");
  const age = (NOW - d.t) / DAY;
  const storage: Storage = age > 260 && chance(0.55) ? "archived" : "online";
  const rec: SeedDataset = {
    pid: pidOf.get(d.tmpId)!,
    datasetName,
    description: src
      ? `${pick(["Reduced", "Integrated", "Refined", "Aligned"])} data derived from ${src.datasetName}. ${pick(NOTES)}`
      : `${TECH_LONG[tech]} of ${sample.sampleName} (${d.cond}), run ${runNumber}. ${pick(NOTES)}`,
    type: d.derived ? "derived" : "raw",
    ownerGroup: p.ownerGroup,
    accessGroups: [p.proposalId],
    instrumentGroup: inst.pid,
    isPublished: false,
    owner: p.pi,
    ownerEmail: p.pi_email,
    orcidOfOwner: orcid || undefined,
    contactEmail: p.pi_email,
    sharedWith,
    sourceFolder: `/data/${p.ownerGroup}/${p.proposalId}/${datasetName}`,
    sourceFolderHost: "fileserver.esss.example",
    size: d.size,
    packedSize: 0,
    numberOfFiles: d.files,
    numberOfFilesArchived: 0,
    creationTime: creation,
    startTime,
    endTime,
    creationLocation: `/Lund/ESS/${inst.name}`,
    dataFormat: d.derived ? DERIVED_FORMAT[tech] ?? "HDF5" : "NeXus (HDF5)",
    runNumber,
    keywords: d.keywords,
    license: "CC BY 4.0",
    classification: "IN=medium,AV=low,CO=low",
    validationStatus: undefined,
    version: "v4",
    datasetlifecycle: lifecycleFor("online", creation),
    techniques: [techniqueOf(tech)],
    principalInvestigators: [p.pi],
    proposalIds: [p.proposalId],
    sampleIds: [sample.sampleId],
    instrumentIds: [inst.pid],
    inputDatasets: src ? [src.pid] : [],
    usedSoftware: src ? [pick(REDUCTION_SOFTWARE)] : [],
    jobParameters: src ? { inputRun: src.runNumber, normalisation: pick(["monitor", "proton charge"]), backgroundSubtraction: chance(0.8) } : undefined,
    scientificMetadata: d.meta,
    createdBy: src ? "reductionService" : "ingestor",
    updatedBy: src ? "reductionService" : "ingestor",
    createdAt: creation,
    updatedAt: creation,
    instrumentName: inst.name,
    proposalId: p.proposalId,
    proposalTitle: p.title,
    sampleId: sample.sampleId,
    sampleName: sample.sampleName,
    thumbSeed: d.thumbSeed,
    thumbStyle: (THUMB_OF[tech] ?? ART_OF[inst.pid].style) as ThumbStyle,
    thumbHue: d.thumbHue,
    history: [],
  };
  if (storage === "archived") setStorage(rec, "archived");
  const history: HistoryEvent[] = [
    ev(creation, "ingested", "Ingestor service", `Ingested from ${rec.sourceFolder}`),
    ev(creation, "created", rec.owner, "Dataset record created"),
  ];
  if (chance(0.3)) history.push(ev(addDays(creation, int(1, 20)), "edited", rec.owner, "Updated description and keywords"));
  if (sharedWith.length) history.push(ev(addDays(creation, int(2, 30)), "shared", rec.owner, `Shared with ${sharedWith.join(", ")}`));
  if (storage === "archived") history.push(ev(addDays(creation, 120), "archived", "Archive service", "Moved to tape archive"));
  rec.history = history.sort((a, b) => a.at.localeCompare(b.at));
  done.set(d.tmpId, rec);
  return rec;
});

const PUBLISHED_TITLES: Record<string, string> = {
  "20240933": "Operando neutron diffraction and tomography of LiFePO₄ cells through 500 cycles",
  "20241150": "Magnetic structure and spin waves in doped Bi₂Se₃",
  "20250334": "Hierarchical structure of tendon collagen: a SANS and reflectometry dataset",
};
// Those three plus most of the long tail; the user's other three rich proposals stay unpublished.
const PUBLISHED_IDS = [...Object.keys(PUBLISHED_TITLES), ...PROPOSALS.filter((p) => !PUBLISHED_TITLES[p.proposalId] && LIGHT.has(p.proposalId) && chance(0.97)).map((p) => p.proposalId)];
const hex = (n: number) => Array.from({ length: n }, () => int(0, 15).toString(16)).join("");

export const published: PublishedData[] = PUBLISHED_IDS.flatMap((pid) => {
  const p = PROPOSALS.find((x) => x.proposalId === pid)!;
  const raws = datasets.filter((d) => d.proposalId === pid && d.type === "raw");
  if (!raws.length) return [];
  // ESS registers its DOIs under 10.17199
  const doi = `10.17199/${int(10000000, 99999999)}-${int(1000, 9999)}`;
  const sets = raws.filter((_, i) => i === 0 || chance(0.4)).slice(0, 12);
  const last = sets.reduce((m, d) => (d.creationTime > m ? d.creationTime : m), p.startTime);
  const registered = addDays(last, 200);
  sets.forEach((d) => {
    d.isPublished = true;
    d.doi = doi;
    d.validationStatus = "validated";
    setStorage(d, "online");
    d.datasetlifecycle = { ...d.datasetlifecycle, publishable: true, dateOfPublishing: registered, publishedOn: registered };
    d.history.push(ev(registered, "published", d.owner, `Published with DOI ${doi}`));
  });
  return [{
    pid: `20.500.12269/${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`,
    doi,
    title: PUBLISHED_TITLES[pid] ?? p.title,
    abstract: p.abstract,
    numberOfFiles: sets.reduce((a, d) => a + d.numberOfFiles, 0),
    sizeOfArchive: sets.reduce((a, d) => a + d.size, 0),
    datasetPids: sets.map((d) => d.pid),
    registeredTime: registered,
    status: "registered",
    metadata: {
      creators: p.team.map((name) => ({ name, affiliation: pick(AFFILIATIONS) })),
      publisher: { name: "European Spallation Source ERIC" },
      publicationYear: new Date(last).getFullYear(),
      resourceType: "Dataset",
      license: "CC BY 4.0",
    },
    createdBy: "datasetIngestor",
    createdAt: registered,
    updatedAt: registered,
    downloads: int(40, 900),
    views: int(300, 5200),
    instrumentIds: [...new Set(sets.flatMap((d) => d.instrumentIds))],
  }];
});

let jobSeq = 1040;
const mineSets = datasets.filter((d) => SEED_USER.groups.includes(d.ownerGroup));
const JOB_MESSAGES: Record<JobKind, Partial<Record<JobStatus, string[]>>> = {
  download: { finishedSuccessful: ["Archive ready · expired after 7 days", "Archive ready"], finishedUnsuccessful: ["Packaging failed — disk quota exceeded"], finishedWithDatasetErrors: ["Checksum mismatch on 2 files; the rest were packaged"], cancelled: ["Cancelled by user"] },
  retrieve: { finishedSuccessful: ["Restored to online storage"], finishedUnsuccessful: ["Tape library timeout — safe to retry", "Tape drive busy, request expired"], finishedWithDatasetErrors: ["1 dataset missing on tape; others restored"], cancelled: ["Cancelled before the tape was mounted"] },
  archive: { finishedSuccessful: ["Written to tape, 2 copies"], finishedUnsuccessful: ["Tape write error — safe to retry"], finishedWithDatasetErrors: ["2 files failed verification"], cancelled: ["Cancelled by user"] },
  publish: { finishedSuccessful: ["DOI minted and landing page live"], finishedUnsuccessful: ["DOI registration rejected: missing creators"], finishedWithDatasetErrors: ["DOI minted; 1 dataset lacks a licence"], cancelled: ["Withdrawn before registration"] },
};
const JOB_MIX: JobKind[] = ["download", "download", "download", "download", "download", "retrieve", "retrieve", "retrieve", "archive", "publish"];
const seededJob = (type: JobKind, statusCode: JobStatus, ageDays: number, message?: string): Job => {
  const sets = shuffle(mineSets).slice(0, int(1, 4));
  const finished = statusCode === "finishedSuccessful";
  const at = new Date(NOW - ageDays * DAY).toISOString();
  return {
    id: `JOB-${jobSeq++}`,
    type,
    statusCode,
    statusMessage: message ?? pick(JOB_MESSAGES[type][statusCode] ?? ["—"]),
    ownerUser: SEED_USER.email,
    ownerGroup: SEED_USER.groups[0],
    contactEmail: SEED_USER.email,
    jobParams: { datasetList: sets.map((s) => ({ pid: s.pid, files: [] })) },
    configVersion: "v1.0.0",
    jobResultObject: {},
    createdAt: at,
    updatedAt: addDays(at, 0),
    progress: finished ? 100 : int(5, 90),
    datasetNames: sets.map((s) => s.datasetName),
    bytes: sets.reduce((a, s) => a + s.size, 0),
  };
};
// mostly successful, with the failure modes SciCat reports
const seededStatus = (): JobStatus => { const r = rnd(); return r < 0.88 ? "finishedSuccessful" : r < 0.94 ? "finishedUnsuccessful" : r < 0.97 ? "finishedWithDatasetErrors" : "cancelled"; };
// Three recent ones the UI leans on, then a year of history: a thousand jobs, newest first.
export const jobs: Job[] = [
  seededJob("retrieve", "finishedSuccessful", 0.2, "Restored to online storage"),
  seededJob("download", "finishedSuccessful", 1.9, "Archive ready · expired after 7 days"),
  seededJob("retrieve", "finishedUnsuccessful", 3.6, "Tape library timeout — safe to retry"),
  ...Array.from({ length: 997 }, (_, i) => seededJob(pick(JOB_MIX), seededStatus(), 4 + i * 0.4 + rnd() * 0.4)),
];

export const nextJobId = () => `JOB-${jobSeq++}`;
export const nextPid = () => `MDC-${new Date().getFullYear() % 100}-${String(datasets.length + 1).padStart(5, "0")}`;
export { ev as makeEvent };

// Attachments, as SciCat keeps them per dataset: a few scripts and logbook notes to start with; users add any file.
const reductionScript = (d: Dataset) => `# ${d.datasetName}: reduction on ${d.instrumentName}
# proposal ${d.proposalId} · run ${d.runNumber} · ${d.techniques[0]?.name ?? ""}
import scipp as sc
from ess import reduce as ess_reduce

run = ess_reduce.load("${d.sourceFolder}/${d.datasetName}.hdf")
run = run.assign_coords(wavelength=sc.scalar(1.0, unit="angstrom"))

# normalise to the incident monitor, subtract the empty-cell background
sample = run["sample"] / run["monitor"].sum()
empty = run["empty_cell"] / run["monitor"].sum()
reduced = (sample - empty).hist(Q=200)

reduced.save_hdf5("${d.datasetName}_reduced.h5")
print("reduced", ${d.numberOfFiles} , "files")
`;
const logbookNote = (d: Dataset) => `# Beamline logbook · ${d.instrumentName}

**Run ${d.runNumber}** · ${d.sampleName} · ${new Date(d.startTime).toISOString().slice(0, 16).replace("T", " ")} UTC

- Beam stable, proton charge ${String(d.scientificMetadata.proton_charge?.value ?? "—")} µAh
- Sample environment as planned; no alarms during the run
- Empty-can reference taken before and after
`;
export const attachments: Attachment[] = [];

// a minimal valid PDF with a few lines of text (ASCII only)
function makePdf(lines: string[]): string {
  const esc = (t: string) => t.replace(/[^\x20-\x7e]/g, "?").replace(/[\\()]/g, "\\$&");
  const content = `BT /F1 15 Tf 56 790 Td 22 TL ${lines.map((l, i) => `${i ? "T* " : ""}(${esc(l)}) Tj`).join(" ")} ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return out;
}
const experimentReport = (d: Dataset) =>
  makePdf([
    `Experiment report - ${d.instrumentName}`,
    "",
    `Proposal ${d.proposalId}: ${d.proposalTitle.slice(0, 70)}`,
    `Dataset ${d.datasetName} (run ${d.runNumber})`,
    `Sample: ${d.sampleName.slice(0, 60)}`,
    `Measured ${new Date(d.startTime).toISOString().slice(0, 16).replace("T", " ")} UTC, ${Math.round((new Date(d.endTime).getTime() - new Date(d.startTime).getTime()) / 60000)} min`,
    "",
    "Summary",
    "Beam was stable and the detector performed within specification.",
    "Calibration and empty-container runs were taken as listed in the logbook.",
    "No radiation damage was observed. Data are ready for reduction.",
  ]);
// x, y and an error column, in the units of the technique
const dataCsv = (d: Dataset) => {
  const tech = d.techniques[0]?.name ?? "";
  const head = tech === "Diffraction" || tech === "Engineering" ? "d_angstrom,counts,error" : tech === "Reflectometry" ? "q_inv_angstrom,reflectivity,error" : tech === "SANS" ? "q_inv_angstrom,intensity,error" : "x,counts,error";
  const rows = Array.from({ length: 40 }, (_, i) => {
    const x = +(0.01 + i * 0.012).toFixed(3);
    const y = +(900 * x ** -1.6 * (1 + 0.15 * Math.sin(i / 3)) + rnd() * 6).toFixed(2);
    return `${x},${y},${+(Math.sqrt(y) * 0.5).toFixed(2)}`;
  });
  return `${head}\n${rows.join("\n")}\n`;
};
const IMAGE_CAPTION: Record<string, string> = {
  sans: "2D detector image, log counts", powder: "Refined powder pattern", reflect: "Reflectivity R(Q) with fit", single: "Bragg peaks on the detector", laue: "Neutron Laue pattern",
  radiograph: "Neutron radiograph", sqw: "S(Q,E) map", qens: "S(Q,omega) map", ins: "Vibrational spectrum",
};
{
  let n = 0;
  for (const d of datasets) {
    const at = addDays(d.creationTime, 0);
    const base = { datasetId: d.pid, ownerGroup: d.ownerGroup, accessGroups: d.accessGroups, isPublished: d.isPublished, createdBy: d.owner, createdAt: at, updatedAt: at };
    const text = (caption: string, fileName: string, mimeType: string, body: string) => attachments.push({ ...base, id: `att-${++n}`, caption, fileName, mimeType, size: body.length, dataUrl: textToDataUrl(body, mimeType) });
    // the dataset's preview picture is an attachment, as in SciCat; it is drawn the first time it is looked at
    const imageId = `att-${++n}`;
    let picture: string | undefined;
    attachments.push(
      Object.defineProperty({ ...base, id: imageId, caption: IMAGE_CAPTION[d.thumbStyle!] ?? "Preview image", fileName: `${d.datasetName}_${d.thumbStyle}.jpg`, mimeType: "image/jpeg", size: int(55000, 130000) } as Attachment, "dataUrl", {
        enumerable: true,
        get: () => (picture ??= thumbUrl(d.thumbSeed!, d.thumbStyle!, d.thumbHue!)),
      }),
    );
    d.thumbnailAttachmentId = imageId;
    if (d.type === "raw") {
      const note = logbookNote(d);
      text("Logbook entry", `logbook_${d.runNumber}.md`, "text/markdown", note);
      if (chance(0.6)) text("Reduction script", `reduce_${d.datasetName}.py`, "text/x-python", reductionScript(d));
      if (chance(0.25)) {
        const pdf = experimentReport(d);
        attachments.push({ ...base, id: `att-${++n}`, caption: "Experiment report", fileName: `report_${d.runNumber}.pdf`, mimeType: "application/pdf", size: pdf.length, dataUrl: textToDataUrl(pdf, "application/pdf") });
      }
      if (chance(0.2)) text("Reduced curve (CSV)", `${d.datasetName}_curve.csv`, "text/csv", dataCsv(d));
    } else {
      text("Reduction parameters", `${d.datasetName}_params.json`, "application/json", JSON.stringify({ input: d.inputDatasets, software: d.usedSoftware, ...(d.jobParameters ?? {}) }, null, 2));
      if (chance(0.7)) text("Reduced curve (CSV)", `${d.datasetName}_curve.csv`, "text/csv", dataCsv(d));
    }
  }
}
export const nextAttachmentId = () => `att-${Math.random().toString(36).slice(2, 10)}`;
