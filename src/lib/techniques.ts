// How each technique is coloured and explained
// Each technique keeps its own hue everywhere it appears (badges, tiles, and the instruments' generated art), so a glance tells SANS from imaging.
export const TECH_HUE: Record<string, [string, string]> = {
  SANS: ["124 58 237", "167 139 250"], Reflectometry: ["13 148 136", "45 212 191"], Diffraction: ["234 88 12", "251 146 60"], "Single-crystal": ["192 38 211", "232 121 249"],
  MX: ["22 163 74", "74 222 128"], Engineering: ["202 138 4", "250 204 21"], Imaging: ["219 39 119", "244 114 182"], Spectroscopy: ["37 99 235", "96 165 250"],
  Backscattering: ["101 163 13", "163 230 53"], Vibrational: ["225 29 72", "251 113 133"],
};

// What each technique measures, in one sentence; the real catalogue would serve this from the instrument record.
export const TECH_INFO: Record<string, { name: string; text: string }> = {
  SANS: { name: "Small-angle neutron scattering", text: "Structure on the 1–100 nm scale in solution or solids; deuterium contrast lets you highlight one component of a complex." },
  Reflectometry: { name: "Neutron reflectometry", text: "Depth profiles of thin films, membranes and interfaces, including buried and liquid ones, with nanometre resolution." },
  Diffraction: { name: "Neutron powder diffraction", text: "Crystal and magnetic structures from powders, sensitive to light elements and to magnetic moments." },
  "Single-crystal": { name: "Single-crystal neutron diffraction", text: "Magnetic and nuclear structures of single crystals, often polarised and under field, pressure or low temperature." },
  MX: { name: "Macromolecular neutron crystallography", text: "Locates hydrogen atoms and protonation states in protein crystals, which X-rays cannot see." },
  Engineering: { name: "Engineering neutron diffraction", text: "Residual stress, strain and phase mapping deep inside engineering components, in situ under load or heat." },
  Imaging: { name: "Neutron imaging", text: "Radiography and tomography that see hydrogen, lithium and water inside metal; energy-selective modes map crystal phases." },
  Spectroscopy: { name: "Inelastic neutron scattering", text: "Excitations such as phonons, magnons and crystal-field levels, from the energy neutrons gain or lose." },
  Backscattering: { name: "Quasielastic neutron backscattering", text: "Slow dynamics at µeV resolution: diffusion, rotation and relaxation in polymers, proteins and ionic conductors." },
  Vibrational: { name: "Vibrational neutron spectroscopy", text: "Molecular vibrations over the whole energy range, especially of hydrogen, with no optical selection rules." },
};
