/** "0812-3456-7890", "+62 812 3456 7890", "812..." -> "6281234567890". null kalau tidak valid. */
export function normalizeWa(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return /^62\d{8,13}$/.test(d) ? d : null;
}

/** "6281234567890" -> "0812-3456-7890" */
export function formatWa(wa: string): string {
  const local = "0" + wa.replace(/^62/, "");
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/** Link wa.me dengan pesan terisi. */
export function waLink(wa: string, text: string): string {
  return `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;
}
