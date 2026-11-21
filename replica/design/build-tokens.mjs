#!/usr/bin/env node
// Membuat tokens.css, tailwind.css (web, Tailwind v4) dan tailwind.preset.cjs (aplikasi kasir, NativeWind)
// dari satu sumber: tokens.json. Jalankan ulang setiap kali tokens.json berubah:
//   node replica/design/build-tokens.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const t = JSON.parse(readFileSync(join(here, "tokens.json"), "utf8"));
const header = "/* Dibuat otomatis dari tokens.json oleh build-tokens.mjs. Jangan diedit manual. */\n";

// Nama peran di tokens.json -> nama warna di Tailwind, supaya kelasnya enak dibaca:
// text-fg, text-muted, bg-surface, border-input, ring-focus, bg-accent, text-on-accent.
const twName = { text: "fg", "text-muted": "muted", "border-input": "input" };
const colors = Object.fromEntries(
  Object.entries(t.color).filter(([k]) => !k.startsWith("_"))
);
const px = (n) => `${n}px`;
const typeScale = Object.fromEntries(
  Object.entries(t.type).filter(([k]) => !k.startsWith("_"))
);

// 1. tokens.css: variabel CSS biasa, bisa dipakai di mana saja (termasuk halaman pratinjau).
let css = header + ":root {\n";
for (const [k, v] of Object.entries(colors)) css += `  --lk-${k}: ${v};\n`;
css += `  --lk-font-sans: ${t.font.sans};\n  --lk-font-mono: ${t.font.mono};\n`;
for (const [k, v] of Object.entries(typeScale)) {
  css += `  --lk-text-${k}: ${px(v.size)};\n  --lk-text-${k}-line: ${px(v.line)};\n  --lk-text-${k}-weight: ${v.weight};\n`;
}
t.space.forEach((v, i) => (css += `  --lk-space-${i}: ${px(v)};\n`));
for (const [k, v] of Object.entries(t.radius)) css += `  --lk-radius-${k}: ${px(v)};\n`;
for (const [k, v] of Object.entries(t.shadow)) css += `  --lk-shadow-${k}: ${v};\n`;
for (const [k, v] of Object.entries(t.motion)) css += `  --lk-motion-${k}: ${v};\n`;
for (const [k, v] of Object.entries(t.control)) if (!k.startsWith("_")) css += `  --lk-control-${k}: ${px(v)};\n`;
css += "}\n";
writeFileSync(join(here, "tokens.css"), css);

// 2. tailwind.css: tema Tailwind v4 untuk web owner. Impor setelah tokens.css.
let tw = header + '@import "tailwindcss";\n@import "./tokens.css";\n\n@theme inline {\n';
for (const k of Object.keys(colors)) tw += `  --color-${twName[k] ?? k}: var(--lk-${k});\n`;
tw += "  --font-sans: var(--lk-font-sans);\n  --font-mono: var(--lk-font-mono);\n";
for (const k of Object.keys(typeScale)) {
  tw += `  --text-${k}: var(--lk-text-${k});\n  --text-${k}--line-height: var(--lk-text-${k}-line);\n  --text-${k}--font-weight: var(--lk-text-${k}-weight);\n`;
}
tw += "  --spacing: 4px;\n";
tw += `  --container-kasir: ${px(t.layout.kasir.max_width)};\n  --container-owner: ${px(t.layout.owner.content_max)};\n`;
for (const k of Object.keys(t.radius)) tw += `  --radius-${k}: var(--lk-radius-${k});\n`;
for (const k of Object.keys(t.shadow)) tw += `  --shadow-${k}: var(--lk-shadow-${k});\n`;
tw += "}\n";
writeFileSync(join(here, "tailwind.css"), tw);

// 3. tailwind.preset.cjs: preset untuk NativeWind (format konfigurasi Tailwind v3), nilai langsung.
const preset = {
  theme: {
    extend: {
      colors: Object.fromEntries(Object.entries(colors).map(([k, v]) => [twName[k] ?? k, v])),
      fontFamily: { sans: ["Inter"], mono: ["monospace"] },
      fontSize: Object.fromEntries(
        Object.entries(typeScale).map(([k, v]) => [k, [px(v.size), { lineHeight: px(v.line), fontWeight: String(v.weight) }]])
      ),
      borderRadius: Object.fromEntries(Object.entries(t.radius).map(([k, v]) => [k, px(v)])),
      height: Object.fromEntries(
        Object.entries(t.control).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [`control-${k}`, px(v)])
      ),
    },
  },
};
writeFileSync(
  join(here, "tailwind.preset.cjs"),
  header + "module.exports = " + JSON.stringify(preset, null, 2) + ";\n"
);

console.log("tokens.css, tailwind.css, tailwind.preset.cjs dibuat dari tokens.json");
