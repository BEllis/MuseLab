export function escapeCiString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
}

export function escapeCiStringLiteral(value: string): string {
  return `"${escapeCiString(value)}"`;
}
