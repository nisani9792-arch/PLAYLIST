export interface MsHit {
  id: string;
  song_name: string;
  artist: string;
  genre: string;
  album: string;
  audio_url: string;
  tags: string[];
}

function normalizeHit(hit: any): MsHit {
  const artists = Array.isArray(hit.artists) ? hit.artists.join(', ') : (hit.artist || hit.artist_name || '');
  const genres = Array.isArray(hit.genres) ? hit.genres[0] || '' : (hit.genre || '');
  const tags = Array.isArray(hit.tags) ? hit.tags : [];
  return {
    id: hit.uid || String(hit.id) || String(Math.random()),
    song_name: hit.name_he || hit.name_en || hit.song_name || hit.name || hit.title || 'Unknown',
    artist: artists || 'Unknown',
    genre: genres,
    album: hit.album || '',
    audio_url: hit.audio_url || hit.stream_url || hit.preview_url || '',
    tags,
  };
}

export async function meilisearchSearch(query: string, limit = 20): Promise<MsHit[]> {
  if (!query.trim()) return [];

  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, limit }),
  });

  if (!res.ok) throw new Error(`Search error: ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map(normalizeHit);
}
