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

/** YouTube sharing URLs are not iframe players; keep the CMS value intact. */
export function videoEmbedSource(value: unknown): string | undefined {
  const source = mediaSource(value);
  if (!source) return undefined;
  const url = new URL(source);
  const host = url.hostname.toLowerCase();
  const youtube = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host);
  const shortLink = host === 'youtu.be' || host === 'www.youtu.be';
  if (!youtube && !shortLink) return source;
  const parts = url.pathname.split('/').filter(Boolean);
  const id = shortLink ? parts[0] : parts[0] === 'watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : undefined;
  if (!id || !/^[\w-]{11}$/.test(id)) return undefined;
  if (parts[0] === 'embed' && youtube) return source;
  const embed = new URL(`https://www.youtube.com/embed/${id}`);
  const time = url.searchParams.get('start') ?? url.searchParams.get('t');
  if (time) {
    const units = time.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    const seconds = /^\d+$/.test(time) ? Number(time) : units ? Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0) : 0;
    if (seconds > 0) embed.searchParams.set('start', String(seconds));
  }
  return embed.href;
}
