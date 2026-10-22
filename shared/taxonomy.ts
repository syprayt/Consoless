export const CATEGORIES = [
  { id: "network", label: "Network" },
  { id: "files", label: "Files" },
  { id: "text", label: "Text" },
  { id: "system", label: "System" },
  { id: "dev", label: "Development" },
  { id: "packages", label: "Packages" },
  { id: "archive", label: "Archives" },
  { id: "media", label: "Media" },
  { id: "shell", label: "Shell" },
  { id: "other", label: "Other" },
] as const

export type CategoryId = (typeof CATEGORIES)[number]["id"]

export const CATEGORY_LABEL: Record<CategoryId, string> = Object.fromEntries(
  CATEGORIES.map((category) => [category.id, category.label]),
) as Record<CategoryId, string>

export const PALETTE: Record<CategoryId, { bg: string; fg: string }> = {
  network: { bg: "#d7ebff", fg: "#0b4f8a" },
  files: { bg: "#ffe8c2", fg: "#8a4b08" },
  text: { bg: "#e4ddff", fg: "#4c2f91" },
  system: { bg: "#e4e7ee", fg: "#2c3648" },
  dev: { bg: "#d5f5e4", fg: "#0d6b45" },
  packages: { bg: "#ffe0cc", fg: "#9a3d09" },
  archive: { bg: "#ffdbe3", fg: "#8d2040" },
  media: { bg: "#fcdcf2", fg: "#8a2468" },
  shell: { bg: "#d4f4f4", fg: "#0c5c66" },
  other: { bg: "#eceae6", fg: "#4a463f" },
}
