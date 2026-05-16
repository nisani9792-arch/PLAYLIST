export type PshSongRow = {
  parasha: string;
  title: string;
  artist: string;
  album: string;
  year: string;
  composer: string;
  section: "parasha" | "haftarah";
};

export function toPlaylistLine(row: PshSongRow): string {
  return `${row.artist} - ${row.title}`;
}
