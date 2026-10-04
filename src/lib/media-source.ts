/** Empty CMS fields and empty embeds must not leave a visible section. */
export function mediaSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const input = value.trim();
  const source = input.match(/src=["']([^"']*)["']/i)?.[1]?.trim() ?? input;
  if (!source) return undefined;
  try {
    const url = new URL(source);
    return url.protocol === 'https:' || url.protocol === 'http:' ? source : undefined;
  } catch { return undefined; }
}
