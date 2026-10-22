export function parentPath(value: string): string {
  const end = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"))
  return end > 0 ? value.slice(0, end) : ""
}

export function baseName(value: string): string {
  const end = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"))
  return end >= 0 ? value.slice(end + 1) : value
}
