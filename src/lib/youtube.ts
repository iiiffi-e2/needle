export function parseYouTubeUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) return match[1];
  }
  return null;
}

export interface YouTubeMetadata {
  title: string;
  thumbnail_url: string;
  duration_seconds: number | null;
}

export async function fetchYouTubeMetadata(
  videoId: string
): Promise<YouTubeMetadata> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

  try {
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || "Unknown Track",
        thumbnail_url:
          data.thumbnail_url ||
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        duration_seconds: null,
      };
    }
  } catch {
    // fall through to defaults
  }

  return {
    title: "YouTube Track",
    thumbnail_url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration_seconds: null,
  };
}

export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&modestbranding=1&rel=0`;
}
