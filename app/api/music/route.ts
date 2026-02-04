import { NextRequest, NextResponse } from 'next/server';

// Mapping from book genres to background music keywords
const GENRE_TO_BACKGROUND_MUSIC: Record<string, string> = {
  'Fiction': 'ambient lo-fi study music',
  'Romance': 'romantic piano instrumental',
  'Science Fiction': 'synthwave cyberpunk ambient',
  'Fantasy': 'epic fantasy orchestral',
  'Mystery': 'dark mysterious ambient',
  'Thriller': 'suspenseful cinematic',
  'Horror': 'dark horror ambient',
  'Historical Fiction': 'classical period music',
  'Young Adult Fiction': 'indie instrumental',
  'Biography': 'inspiring instrumental',
  'Self-Help': 'calm meditation music',
  'Business': 'focus productivity music',
  'Science': 'ambient space music',
  'Philosophy': 'contemplative classical',
  'Poetry': 'emotional piano',
  'Drama': 'emotional cinematic',
  'Adventure': 'epic adventure orchestral',
  'Crime': 'noir jazz',
  'Dystopian': 'dark electronic ambient',
  'Paranormal': 'ethereal ambient',
  'Contemporary': 'modern indie instrumental',
  'Literary Fiction': 'sophisticated jazz',
  'Classics': 'timeless classical',
  'default': 'ambient reading music'
};

// Mapping from book genres to pop songs keywords
const GENRE_TO_POP_SONGS: Record<string, string> = {
  'Fiction': 'indie pop songs',
  'Romance': 'love songs romantic playlist',
  'Science Fiction': 'electronic pop songs',
  'Fantasy': 'epic pop songs',
  'Mystery': 'alternative rock songs',
  'Thriller': 'intense rock songs',
  'Horror': 'dark alternative songs',
  'Historical Fiction': 'classic songs',
  'Young Adult Fiction': 'pop hits playlist',
  'Biography': 'inspiring pop songs',
  'Self-Help': 'uplifting pop songs',
  'Business': 'motivational songs',
  'Science': 'electronic songs',
  'Philosophy': 'indie folk songs',
  'Poetry': 'emotional ballads',
  'Drama': 'powerful ballads',
  'Adventure': 'energetic pop songs',
  'Crime': 'rock songs',
  'Dystopian': 'alternative pop songs',
  'Paranormal': 'ethereal pop songs',
  'Contemporary': 'modern pop hits',
  'Literary Fiction': 'indie songs',
  'Classics': 'timeless songs',
  'default': 'pop songs playlist'
};

function parseISO8601DurationToSeconds(iso: string) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function findBestGenreQuery(genre: string | null, map: Record<string, string>) {
  if (!genre) return map['default'];
  const g = genre.trim().toLowerCase();
  for (const key of Object.keys(map)) {
    if (key.toLowerCase() === g) return map[key];
  }
  for (const key of Object.keys(map)) {
    const keyLower = key.toLowerCase();
    if (g.includes(keyLower) || keyLower.includes(g)) return map[key];
  }
  return map['default'];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genre = searchParams.get('genre');
  const type = (searchParams.get('type') || 'background').toString(); // 'background' or 'songs'
  const songGenre = (searchParams.get('songGenre') || 'any').toString();
  const allDurations = searchParams.get('allDurations') === 'true';
  const searchQuery = searchParams.get('q') || ''; // Declare searchQuery variable
  
  // Fixed duration rules based on music type (unless allDurations is enabled)
  let minDuration: number;
  let maxDuration: number;
  
  if (allDurations) {
    minDuration = 0; // No minimum
    maxDuration = 999; // Effectively no maximum
  } else if (type === 'background') {
    minDuration = 30; // 30 minutes minimum
    maxDuration = 240; // 4 hours maximum
  } else {
    minDuration = 0; // No minimum for songs
    maxDuration = 10; // 10 minutes maximum
  }

  if (!genre) {
    return NextResponse.json({ error: 'Genre parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  try {
    // Build base query
    let baseQuery = '';
    if (type === 'background') {
      baseQuery = findBestGenreQuery(genre, GENRE_TO_BACKGROUND_MUSIC);
    } else {
      baseQuery = findBestGenreQuery(genre, GENRE_TO_POP_SONGS);
      if (songGenre && songGenre !== 'any') {
        baseQuery += ` ${songGenre}`;
      }
    }

    // hint for playlist search
    let durationQuery = baseQuery;
    if (type === 'background') {
      durationQuery += ' long version extended playlist 1 hour';
    } else {
      durationQuery += ' playlist';
    }

    console.log('[v1-playlist] Searching YouTube for playlists:', durationQuery, 'genre:', genre, 'type:', type, 'songGenre:', songGenre);

    // 1) Search playlists
    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(durationQuery)}&type=playlist&maxResults=10&key=${apiKey}`
    );
    console.log('[v1-playlist] YouTube API playlist search URL:', searchRes.url);
    if (!searchRes.ok) {
      const errorData = await searchRes.json();
      console.error('[v1-playlist] YouTube API error (search playlists):', errorData);
      throw new Error('Failed to fetch playlist search');
    }
    const searchData = await searchRes.json();
    const playlistIds: string[] = (searchData.items || [])
      .map((it: any) => it.id.playlistId)
      .filter(Boolean);

    // 2) For each playlist, fetch playlistItems to collect video ids and snippet info
    const playlistItemsFetches = playlistIds.map((pid) =>
      fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=10&playlistId=${pid}&key=${apiKey}`)
        .then(async (r) => r.ok ? r.json() : Promise.reject(await r.json()))
        .catch((e) => {
          console.warn('[v1-playlist] Failed to fetch playlistItems for', pid, e);
          return { items: [] };
        })
    );

    const playlistsItemsData = await Promise.all(playlistItemsFetches);
    console.log('[v1-playlist] Fetched playlistItems for playlists:', playlistsItemsData);

    // Flatten into video entries with snippet + videoId
    const videoEntries: Array<{ videoId: string; snippet: any }> = [];
    for (const p of playlistsItemsData) {
      for (const it of (p.items || [])) {
        const videoId = it.snippet?.resourceId?.videoId || it.snippet?.videoOwnerChannelId || null;
        if (videoId) {
          videoEntries.push({ videoId, snippet: it.snippet });
        }
      }
    }

    // If no video entries found, fallback to searching videos directly so we still return results
    let videosToQuery = videoEntries;
    if (videosToQuery.length === 0) {
      console.warn('[v1-playlist] No videos found in playlists, falling back to video search');
      const fallbackSearch = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=video&maxResults=15&key=${apiKey}`
      );
      if (fallbackSearch.ok) {
        const fb = await fallbackSearch.json();
        for (const it of (fb.items || [])) {
          const vid = it.id?.videoId;
          if (vid) videosToQuery.push({ videoId: vid, snippet: it.snippet });
        }
      }
    }

    // 3) Collect videoIds and fetch their durations
    const uniqueVideoIds = Array.from(new Set(videosToQuery.map(v => v.videoId))).slice(0, 50); // cap to 50
    let durationsById: Record<string, number> = {};
    if (uniqueVideoIds.length > 0) {
      const chunks: string[] = [];
      for (let i = 0; i < uniqueVideoIds.length; i += 50) {
        chunks.push(uniqueVideoIds.slice(i, i + 50).join(','));
      }
      for (const chunk of chunks) {
        try {
          const vidsRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${chunk}&key=${apiKey}`
          );
          if (vidsRes.ok) {
            const vidsData = await vidsRes.json();
            (vidsData.items || []).forEach((v: any) => {
              durationsById[v.id] = parseISO8601DurationToSeconds(v.contentDetails?.duration || '');
            });
          }
        } catch (e) {
          console.warn('[v1-playlist] Failed to fetch video durations for chunk', e);
        }
      }
    }

    // 4) Build tracks in same shape as before
    const minSeconds = minDuration * 60;
    const maxSeconds = maxDuration * 60;

    const tracks = videosToQuery.map((entry, index) => {
      const vid = entry.videoId;
      let durationSeconds = durationsById[vid] || 0;
      let durationStr = '3:45';
      if (durationSeconds > 0) {
        const h = Math.floor(durationSeconds / 3600);
        const m = Math.floor((durationSeconds % 3600) / 60);
        const s = durationSeconds % 60;
        durationStr = h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
      } else {
        // fallback heuristic
        if (type === 'background') {
          const genMin = Math.max(1, minDuration);
          const genMax = Math.min(maxDuration, 60);
          const range = Math.max(0, genMax - genMin);
          const randomMinutes = genMin + (range > 0 ? Math.floor(Math.random() * (range + 1)) : 0);
          const randomSeconds = Math.floor(Math.random() * 60);
          durationStr = `${randomMinutes}:${String(randomSeconds).padStart(2, '0')}`;
          durationSeconds = randomMinutes * 60 + randomSeconds;
        } else {
          const randomMinutes = 2 + Math.floor(Math.random() * 3);
          const randomSeconds = Math.floor(Math.random() * 60);
          durationStr = `${randomMinutes}:${String(randomSeconds).padStart(2, '0')}`;
          durationSeconds = randomMinutes * 60 + randomSeconds;
        }
      }

      const snippet = entry.snippet || {};
      const title = snippet.title || `Video ${index + 1}`;
      const artist = snippet.channelTitle || snippet.videoOwnerChannelTitle || 'Unknown';
      const cover = snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || null;

      return {
        id: vid,
        title,
        artist,
        duration: durationStr,
        durationSeconds,
        cover,
        youtubeUrl: `https://www.youtube.com/watch?v=${vid}`,
        isPlaying: index === 0,
        type,
        genre: songGenre !== 'any' ? songGenre : undefined
      };
    });

    // 5) Filter tracks same as before
    const filtered = tracks.filter((track: any) => {
      // Duration filter - skip if allDurations is enabled
      if (!allDurations) {
        const ds = track.durationSeconds || (() => {
          const parts = String(track.duration).split(':').map(p => parseInt(p || '0', 10));
          if (parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
          if (parts.length === 2) return parts[0]*60 + parts[1];
          if (parts.length === 1) return parts[0];
          return 0;
        })();
        if (!ds) return false;
        if (ds < minSeconds || ds > maxSeconds) return false;
      }

      if (type === 'songs' && songGenre && songGenre !== 'any') {
        const g = songGenre.toLowerCase();
        const titleLower = track.title.toLowerCase();
        const artistLower = track.artist.toLowerCase();
        if (!(titleLower.includes(g) || artistLower.includes(g))) return false;
      }

      return true;
    });

    console.log('[v1-playlist] Server-side filtered tracks:', filtered.length, 'from', tracks.length);

    return NextResponse.json({
      tracks: filtered,
      genre,
      searchQuery: durationQuery,
      type,
      songGenre,
      allDurations,
      preferences: { minDuration, maxDuration, minSeconds, maxSeconds }
    });
  } catch (error) {
    console.error('[v1-playlist] Music API error:', error);
    return NextResponse.json({ error: 'Failed to fetch music' }, { status: 500 });
  }
}
