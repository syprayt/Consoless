export function isLocalPath(value: string): boolean {
  return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)
}

export function joinChild(parent: string, name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed || trimmed === "." || trimmed === ".." || trimmed.startsWith("-") || /[/\\\0]/.test(trimmed)) return null
  return `${parent.replace(/\/$/, "")}/${trimmed}`
}
