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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const genre = searchParams.get('genre');
  const type = searchParams.get('type') || 'background'; // 'background' or 'songs'
  const minDuration = parseInt(searchParams.get('minDuration') || '3');
  const maxDuration = parseInt(searchParams.get('maxDuration') || '60');
  const customKeywords = searchParams.get('keywords') || '';

  if (!genre) {
    return NextResponse.json({ error: 'Genre parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }

  try {
    // Build search query based on type and preferences
    let baseQuery = '';
    if (type === 'background') {
      baseQuery = GENRE_TO_BACKGROUND_MUSIC[genre] || GENRE_TO_BACKGROUND_MUSIC['default'];
    } else {
      baseQuery = GENRE_TO_POP_SONGS[genre] || GENRE_TO_POP_SONGS['default'];
    }
    
    // Add custom keywords if provided
    const searchQuery = customKeywords ? `${baseQuery} ${customKeywords}` : baseQuery;
    
    // Add duration filter to search query
    let durationQuery = searchQuery;
    if (type === 'background' && minDuration >= 10) {
      durationQuery += ' long version extended';
    }
    

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(durationQuery)}&type=video&videoCategoryId=10&maxResults=15&key=${apiKey}`
    );
    console.log(      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(durationQuery)}&type=video&videoCategoryId=10&maxResults=15&key=${apiKey}`
)
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error('Failed to fetch music');
    }

    const data = await response.json();
    
    // Transform the data to a simpler format
    const tracks = data.items?.map((item: any, index: number) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      artist: item.snippet.channelTitle,
      duration: '3:45', // YouTube API v3 requires additional call for duration, using placeholder
      cover: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
      youtubeUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      isPlaying: index === 0, // First track is playing by default
    })) || [];

    return NextResponse.json({ 
      tracks, 
      genre, 
      searchQuery: durationQuery,
      type,
      preferences: { minDuration, maxDuration }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch music' }, { status: 500 });
  }
}
