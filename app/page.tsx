'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Music, Sparkles, Disc3, Play, X, Zap, Loader2, Settings2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'

type MusicType = 'background' | 'songs'

interface Book {
  id: string
  title: string
  author: string
  cover: string
  genre: string
  description?: string
  etag?: string
  pageCount?: number
  publishedDate?: string
}

interface MusicPreferences {
  type: MusicType
  minDuration: number // in minutes
  maxDuration: number // in minutes
  customKeywords: string
  songGenre?: string // 'pop' | 'rock' | 'electronic' | 'any'
}

interface Track {
  id: string
  title: string
  artist: string
  duration: string
  cover?: string
  youtubeUrl?: string
  isPlaying?: boolean
}

interface MoodType {
  [key: string]: string
}

const MOCK_BOOKS: Book[] = [
  {
    id: '1',
    title: 'Neuromancer',
    author: 'William Gibson',
    cover: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&h=600&fit=crop',
    genre: 'Cyberpunk'
  },
  {
    id: '2',
    title: 'The Secret History',
    author: 'Donna Tartt',
    cover: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400&h=600&fit=crop',
    genre: 'Dark Academia'
  },
  {
    id: '3',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    cover: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&h=600&fit=crop',
    genre: 'Romance'
  }
]

const GENRE_TO_MOOD: { [key: string]: string } = {
  'Cyberpunk': 'scifi',
  'Dark Academia': 'mystery',
  'Romance': 'romantic',
  'default': 'mystery'
}

const GENRE_PLAYLISTS: { [key: string]: Track[] } = {
  'scifi': [
    { id: '1', title: 'Space Odyssey', artist: 'Galactic Groove', duration: '4:30' },
    { id: '2', title: 'Alien Pulse', artist: 'Interstellar Beats', duration: '5:15' }
  ],
  'mystery': [
    { id: '3', title: 'Shadow Symphony', artist: 'Mystic Melodies', duration: '3:45' },
    { id: '4', title: 'Enigma Echo', artist: 'Cryptic Crescendo', duration: '4:00' }
  ],
  'romantic': [
    { id: '5', title: 'Love Serenade', artist: 'Heartfelt Harmony', duration: '3:00' },
    { id: '6', title: 'Passionate Waltz', artist: 'Emotional Euphoria', duration: '3:30' }
  ]
}

const MOOD_COLORS: { [key: string]: string } = {
  'scifi': '#8B5CF6',
  'mystery': '#FBBF24',
  'romantic': '#10B981'
}

const ACCENT_COLOR = '#8B5CF6' // Single primary color for the interface

export default function ChapterBeats() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Book[]>([])
  const [tracks, setTracks] = useState<Track[]>([])
  const [isLoadingMusic, setIsLoadingMusic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showResults, setShowResults] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [currentMood, setCurrentMood] = useState<string>('mystery')
  const [history, setHistory] = useState<Book[]>([])
  
  // Music preferences
  const [musicPrefs, setMusicPrefs] = useState<MusicPreferences>({
    type: 'background',
    minDuration: 3,
    maxDuration: 60,
    customKeywords: '',
    songGenre: 'any'
  })

  // Helper functions for filtering
  const parseDurationToSeconds = useCallback((duration: string): number => {
    if (!duration) return 0
    
    // If it's already a number, return it
    if (!isNaN(Number(duration))) return Number(duration)
    
    // Parse "M:SS", "MM:SS", "H:MM:SS" format
    const parts = duration.split(':').map(p => parseInt(p, 10))
    
    if (parts.length === 3) {
      // H:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    } else if (parts.length === 2) {
      // M:SS or MM:SS
      return parts[0] * 60 + parts[1]
    } else if (parts.length === 1) {
      // Just seconds
      return parts[0]
    }
    
    return 0
  }, [])

  const filterTracksByPrefs = useCallback((tracks: Track[], prefs: MusicPreferences): Track[] => {
    
    let minSeconds = prefs.minDuration * 60
    let maxSeconds = prefs.maxDuration * 60
    
    // Swap if min > max
    if (minSeconds > maxSeconds) {
      [minSeconds, maxSeconds] = [maxSeconds, minSeconds]
    }
    
    return tracks.filter(track => {
      // Duration filter
      const durationSeconds = parseDurationToSeconds(track.duration)
      if (durationSeconds === 0) return false // Exclude tracks with no duration
      if (durationSeconds < minSeconds || durationSeconds > maxSeconds) return false
      
      // Song genre filter (only when type is 'songs' and not 'any')
      if (prefs.type === 'songs' && prefs.songGenre && prefs.songGenre !== 'any') {
        const genre = prefs.songGenre.toLowerCase()
        const titleLower = track.title.toLowerCase()
        const artistLower = track.artist.toLowerCase()
        
        const matches = titleLower.includes(genre) || artistLower.includes(genre)
        if (!matches) return false
      }
      
      // Keywords filter
      if (prefs.customKeywords.trim()) {
        const keywords = prefs.customKeywords.toLowerCase().split(/\s+/)
        const searchText = `${track.title} ${track.artist}`.toLowerCase()
        
        const allMatch = keywords.every(kw => searchText.includes(kw))
        if (!allMatch) return false
      }
      
      return true
    })
  }, [parseDurationToSeconds])

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('chapterbeats-history')
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory))
      } catch (e) {
        console.error('Failed to parse history from localStorage', e)
      }
    }
  }, [])

  // Save book to history
  const addToHistory = useCallback((book: Book) => {
    setHistory((prev) => {
      // Remove duplicates and add to front
      const filtered = prev.filter((b) => b.id !== book.id)
      const newHistory = [book, ...filtered].slice(0, 10) // Keep last 10
      localStorage.setItem('chapterbeats-history', JSON.stringify(newHistory))
      return newHistory
    })
  }, [])

  // Live search with debounce
  const performSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setError(null)
    setShowResults(true)

    try {
      
      const booksResponse = await fetch(`/api/books?q=${encodeURIComponent(query)}`)
      const booksData = await booksResponse.json()


      if (booksData.error) {
        throw new Error(booksData.error)
      }

      if (!booksData.books || booksData.books.length === 0) {
        setSearchResults([])
        setError('No books found')
        return
      }

      // Limit to 5 most relevant
      const books = booksData.books.slice(0, 5)
      console.log(books)
      books.forEach((book: Book) => {
        console.log(book.cover)
      })

      setSearchResults(books)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search books')
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery)
    }, 500)

    return () => clearTimeout(timer)
  }, [searchQuery, performSearch])

  const handleVibeCheck = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setError(null)

    try {
      
      // Search for books using Google Books API
      const booksResponse = await fetch(`/api/books?q=${encodeURIComponent(searchQuery)}`)
      const booksData = await booksResponse.json()


      if (booksData.error) {
        throw new Error(booksData.error)
      }

      if (!booksData.books || booksData.books.length === 0) {
        setError('No books found. Try a different search term.')
        setIsSearching(false)
        return
      }

      // Map books to include mood
      const booksWithMood = booksData.books.map((book: Book) => ({
        ...book,
        mood: GENRE_TO_MOOD[book.genre] || GENRE_TO_MOOD['default']
      }))

      setSearchResults(booksWithMood)
      
      // Auto-select first book
      const firstBook = booksWithMood[0]
      await handleBookSelect(firstBook)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search books')
    } finally {
      setIsSearching(false)
    }
  }

  const handleBookSelect = async (book: Book) => {
    setSelectedBook(book)
    addToHistory(book)
    setIsLoadingMusic(true)
    setError(null)
    setShowResults(false)

    try {
      
      // Build query parameters
      const params = new URLSearchParams({
        genre: book.genre,
        type: musicPrefs.type,
        minDuration: musicPrefs.minDuration.toString(),
        maxDuration: musicPrefs.maxDuration.toString(),
      })
      
      if (musicPrefs.customKeywords.trim()) {
        params.append('keywords', musicPrefs.customKeywords)
      }
      
      if (musicPrefs.songGenre && musicPrefs.songGenre !== 'any') {
        params.append('songGenre', musicPrefs.songGenre)
      }
      
      // Fetch music based on book genre and preferences
      const musicResponse = await fetch(`/api/music?${params.toString()}`)
      const musicData = await musicResponse.json()


      if (musicData.error) {
        throw new Error(musicData.error)
      }

      if (!musicData.tracks || musicData.tracks.length === 0) {
        setError('No music found for this book')
        setTracks([])
      } else {
        // Apply client-side filtering as safety net
        const filteredTracks = filterTracksByPrefs(musicData.tracks, musicPrefs)
        
        if (filteredTracks.length === 0) {
          setError('No music matches your filter preferences')
          setTracks([])
        } else {
          setTracks(filteredTracks)
        }
      }
      
    } catch (err) {
      setError('Failed to fetch music')
      setTracks([])
    } finally {
      setIsLoadingMusic(false)
    }
  }

  const handleReset = () => {
    setSelectedBook(null)
    setSearchQuery('')
    setShowResults(false)
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-hidden">
      <AnimatePresence mode="wait">
        {!selectedBook ? (
          <motion.div
            key="search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="min-h-screen flex flex-col items-center justify-center p-8"
          >
            {/* Hero Section */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-12"
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <Music className="w-12 h-12" style={{ color: ACCENT_COLOR }} />
                <h1 className="text-7xl font-black tracking-tight">
                  CHAPTER<span style={{ color: ACCENT_COLOR }}>BEATS</span>
                </h1>
              </div>
              <p className="text-xl text-gray-400 font-mono">
                {'// Literary Soundtrack Generator'}
              </p>
            </motion.div>

            {/* Search Input with Neo-Brutalist Style */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="w-full max-w-3xl"
            >
              <div
                className="bg-white/5 backdrop-blur-sm p-8 relative"
                style={{
                  border: '4px solid #000',
                  boxShadow: `8px 8px 0px ${ACCENT_COLOR}`
                }}
              >
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search 
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500" 
                    />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && searchResults.length > 0) {
                          handleBookSelect(searchResults[0])
                        }
                      }}
                      placeholder="Search for a book, author, or vibe..."
                      className="h-16 pl-14 text-xl bg-[#1a1a1a] border-4 border-black focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none font-mono"
                      style={{
                        boxShadow: 'inset 4px 4px 0px rgba(0,0,0,0.5)'
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => setShowSettings(!showSettings)}
                    size="icon"
                    className="h-16 w-16 rounded-none border-4 border-black transition-all duration-200 hover:translate-x-1 hover:translate-y-1"
                    style={{
                      backgroundColor: showSettings ? ACCENT_COLOR : 'transparent',
                      color: showSettings ? '#fff' : ACCENT_COLOR,
                      borderColor: '#000',
                      boxShadow: `4px 4px 0px #000`,
                    }}
                  >
                    <Settings2 className="w-6 h-6" />
                  </Button>
                  <Button
                    onClick={() => searchResults.length > 0 && handleBookSelect(searchResults[0])}
                    disabled={isSearching || searchResults.length === 0}
                    size="lg"
                    className="h-16 px-8 text-lg font-black rounded-none border-4 border-black transition-all duration-200 hover:translate-x-1 hover:translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: ACCENT_COLOR,
                      color: '#fff',
                      boxShadow: `4px 4px 0px #000`,
                    }}
                  >
                    {isSearching ? (
                      <Sparkles className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        VIBE CHECK
                      </>
                    )}
                  </Button>
                </div>

                {/* Music Preferences Settings */}
                <AnimatePresence>
                  {showSettings && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-6 overflow-hidden"
                    >
                      <div className="p-6 bg-[#0a0a0a] border-2 border-black space-y-6">
                        {/* Music Type Selection */}
                        <div>
                          <label className="text-sm text-gray-400 font-mono mb-3 block">MUSIC TYPE:</label>
                          <div className="flex gap-3">
                            <Badge
                              onClick={() => setMusicPrefs({ ...musicPrefs, type: 'background' })}
                              className="cursor-pointer px-6 py-2 rounded-none border-2 border-black font-mono text-sm font-bold uppercase transition-all hover:scale-105"
                              style={{
                                backgroundColor: musicPrefs.type === 'background' ? ACCENT_COLOR : 'transparent',
                                color: musicPrefs.type === 'background' ? '#fff' : ACCENT_COLOR,
                                borderColor: ACCENT_COLOR,
                              }}
                            >
                              Background Music
                            </Badge>
                            <Badge
                              onClick={() => setMusicPrefs({ ...musicPrefs, type: 'songs' })}
                              className="cursor-pointer px-6 py-2 rounded-none border-2 border-black font-mono text-sm font-bold uppercase transition-all hover:scale-105"
                              style={{
                                backgroundColor: musicPrefs.type === 'songs' ? ACCENT_COLOR : 'transparent',
                                color: musicPrefs.type === 'songs' ? '#fff' : ACCENT_COLOR,
                                borderColor: ACCENT_COLOR,
                              }}
                            >
                              Pop Songs
                            </Badge>
                          </div>
                        </div>

                        {/* Song Genre Selection - Only show when type is 'songs' */}
                        {musicPrefs.type === 'songs' && (
                          <div>
                            <label className="text-sm text-gray-400 font-mono mb-3 block">SONG STYLE:</label>
                            <div className="flex flex-wrap gap-3">
                              {['any', 'pop', 'rock', 'electronic', 'indie', 'jazz'].map((genre) => (
                                <Badge
                                  key={genre}
                                  onClick={() => setMusicPrefs({ ...musicPrefs, songGenre: genre })}
                                  className="cursor-pointer px-4 py-1.5 rounded-none border-2 border-black font-mono text-xs font-bold uppercase transition-all hover:scale-105"
                                  style={{
                                    backgroundColor: musicPrefs.songGenre === genre ? ACCENT_COLOR : 'transparent',
                                    color: musicPrefs.songGenre === genre ? '#fff' : ACCENT_COLOR,
                                    borderColor: ACCENT_COLOR,
                                  }}
                                >
                                  {genre}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Duration Controls */}
                        <div>
                          <label className="text-sm text-gray-400 font-mono mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            MIN DURATION: {musicPrefs.minDuration} MIN
                          </label>
                          <Slider
                            value={[musicPrefs.minDuration]}
                            onValueChange={(value) => setMusicPrefs({ ...musicPrefs, minDuration: value[0] })}
                            min={1}
                            max={30}
                            step={1}
                            className="w-full"
                          />
                        </div>

                        <div>
                          <label className="text-sm text-gray-400 font-mono mb-3 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            MAX DURATION: {musicPrefs.maxDuration} MIN
                          </label>
                          <Slider
                            value={[musicPrefs.maxDuration]}
                            onValueChange={(value) => setMusicPrefs({ ...musicPrefs, maxDuration: value[0] })}
                            min={5}
                            max={120}
                            step={5}
                            className="w-full"
                          />
                        </div>

                        {/* Custom Keywords */}
                        <div>
                          <label className="text-sm text-gray-400 font-mono mb-3 block">CUSTOM KEYWORDS:</label>
                          <Input
                            value={musicPrefs.customKeywords}
                            onChange={(e) => setMusicPrefs({ ...musicPrefs, customKeywords: e.target.value })}
                            placeholder="e.g. jazz, piano, upbeat..."
                            className="h-12 bg-[#1a1a1a] border-2 border-black focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none font-mono"
                            style={{
                              boxShadow: 'inset 2px 2px 0px rgba(0,0,0,0.5)'
                            }}
                          />
                          <p className="text-xs text-gray-600 mt-2 font-mono">Add keywords to refine music search</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* Live Search Results */}
            <AnimatePresence>
              {showResults && searchQuery.length >= 2 && (
                <motion.div
                  initial={{ y: 20, opacity: 0, height: 0 }}
                  animate={{ y: 0, opacity: 1, height: 'auto' }}
                  exit={{ y: 20, opacity: 0, height: 0 }}
                  className="mt-6 w-full max-w-3xl"
                >
                  <div
                    className="bg-[#0a0a0a] backdrop-blur-sm overflow-hidden"
                    style={{
                      border: '4px solid #000',
                      boxShadow: `6px 6px 0px ${ACCENT_COLOR}`
                    }}
                  >
                    <div className="p-4 border-b-4 border-black flex items-center justify-between">
                      <p className="text-sm font-mono font-bold" style={{ color: ACCENT_COLOR }}>
                        {isSearching ? 'SEARCHING...' : `FOUND ${searchResults.length} RESULTS`}
                      </p>
                      {isSearching && <Loader2 className="w-4 h-4 animate-spin" style={{ color: ACCENT_COLOR }} />}
                    </div>
                    
                    {searchResults.length > 0 ? (
                      <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                        {searchResults.map((book, index) => (
                          <motion.button
                            key={book.etag}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleBookSelect(book)}
                            className="w-full p-4 flex gap-4 items-start hover:bg-white/5 transition-colors border-b-2 border-black/50 last:border-b-0 text-left group"
                          >
                            <img
                              src={book.cover || "/placeholder.svg"}
                              alt={book.title}
                              className="w-16 h-24 object-cover border-2 border-black group-hover:scale-105 transition-transform"
                              style={{ boxShadow: `3px 3px 0px ${ACCENT_COLOR}` }}
                            />
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-lg line-clamp-1 mb-1">{book.title}</h4>
                              <p className="text-sm text-gray-400 mb-2">{book.author}</p>
                              <Badge
                                className="rounded-none border-2 border-black font-mono text-xs px-2 py-0.5"
                                style={{
                                  backgroundColor: `${ACCENT_COLOR}20`,
                                  color: ACCENT_COLOR,
                                  borderColor: ACCENT_COLOR
                                }}
                              >
                                {book.genre}
                              </Badge>
                            </div>
                            <Play className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity self-center" style={{ color: ACCENT_COLOR }} />
                          </motion.button>
                        ))}
                      </div>
                    ) : !isSearching && error && (
                      <div className="p-8 text-center">
                        <p className="text-gray-500 font-mono">{error}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* History - only show when no search */}
            {!showResults && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-12 text-center"
              >
                {history.length > 0 ? (
                  <>
                    <p className="text-sm text-gray-500 font-mono mb-4">RECENTLY VIEWED:</p>
                    <div className="flex gap-4 flex-wrap justify-center max-w-4xl">
                      {history.map((book) => (
                        <button
                          key={book.id}
                          onClick={() => handleBookSelect(book)}
                          className="group relative overflow-hidden"
                          style={{
                            border: '3px solid #000',
                            boxShadow: '4px 4px 0px #000'
                          }}
                        >
                          <img
                            src={book.cover || "/placeholder.svg"}
                            alt={book.title}
                            className="w-32 h-48 object-cover transition-transform group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                            <p className="text-xs font-bold line-clamp-2">{book.title}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="p-12 border-2 border-dashed border-gray-800 rounded-none">
                    <Music className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                    <p className="text-gray-500 font-mono text-sm">No history yet</p>
                    <p className="text-gray-600 font-mono text-xs mt-2">Search for a book to get started</p>
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="min-h-screen p-8 flex"
          >
            {/* Close Button */}
            <Button
              onClick={handleReset}
              size="icon"
              className="absolute top-8 right-8 rounded-none border-4 border-black z-50 w-14 h-14"
              style={{
                backgroundColor: ACCENT_COLOR,
                color: '#fff',
                boxShadow: '4px 4px 0px #000'
              }}
            >
              <X className="w-6 h-6" />
            </Button>

            <div className="flex flex-1 gap-8 max-w-7xl mx-auto w-full">
              {/* Book Spotlight */}
              <motion.div
                initial={{ x: -100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
                className="flex-1 flex items-center justify-center relative"
              >
                <div className="relative">
                  {/* Rotating Vinyl Background */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    className="absolute -inset-16 flex items-center justify-center"
                  >
                    <Disc3 
                      className="w-96 h-96 opacity-20"
                      style={{ color: ACCENT_COLOR }}
                    />
                  </motion.div>

                  {/* Glassmorphic Book Card */}
                  <Card
                    className="relative z-10 p-8 rounded-none overflow-hidden"
                    style={{
                      border: '4px solid #000',
                      boxShadow: `12px 12px 0px ${ACCENT_COLOR}`,
                      background: `linear-gradient(135deg, ${ACCENT_COLOR}20, transparent)`,
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    <motion.img
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      src={selectedBook.cover}
                      alt={selectedBook.title}
                      className="w-80 h-[480px] object-cover mb-6"
                      style={{
                        border: '4px solid #000',
                        boxShadow: '8px 8px 0px #000'
                      }}
                    />
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.6 }}
                    >
                      <h2 className="text-4xl font-black mb-2">{selectedBook.title}</h2>
                      <p className="text-xl text-gray-400 mb-4">{selectedBook.author}</p>
                      <Badge
                        className="rounded-none border-2 border-black font-mono font-bold px-4 py-1"
                        style={{
                          backgroundColor: ACCENT_COLOR,
                          color: '#fff'
                        }}
                      >
                        {selectedBook.genre}
                      </Badge>
                    </motion.div>
                  </Card>
                </div>
              </motion.div>

              {/* Soundtrack Panel - Cassette Tapes */}
              <motion.div
                initial={{ x: 100, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
                className="w-[450px]"
              >
                <div className="sticky top-8">
                  <div className="mb-6 flex items-center gap-3">
                    <Music className="w-8 h-8" style={{ color: ACCENT_COLOR }} />
                    <h3 className="text-3xl font-black">SOUNDTRACK</h3>
                  </div>

                  {isLoadingMusic ? (
                    <div className="flex items-center justify-center h-64">
                      <Loader2 className="w-12 h-12 animate-spin" style={{ color: ACCENT_COLOR }} />
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
                      {tracks.map((track, index) => (
                        <motion.div
                          key={track.id}
                          initial={{ x: 50, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          className="group relative"
                        >
                          {/* Cassette Tape Card */}
                          <div
                            onClick={() => {
                              if (track.youtubeUrl) {
                                window.open(track.youtubeUrl, '_blank')
                              }
                            }}
                            className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] p-6 relative overflow-hidden cursor-pointer hover:translate-x-1 hover:translate-y-1 transition-transform"
                            style={{
                              border: '4px solid #000',
                              boxShadow: `6px 6px 0px ${ACCENT_COLOR}`
                            }}
                          >
                            {/* Cassette Reels */}
                            <div className="absolute top-3 right-3 flex gap-2">
                              <div 
                                className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                                style={{ borderColor: ACCENT_COLOR }}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_COLOR }} />
                              </div>
                              <div 
                                className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                                style={{ borderColor: ACCENT_COLOR }}
                              >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ACCENT_COLOR }} />
                              </div>
                            </div>

                            <div className="flex items-start gap-4">
                              <Button
                                size="icon"
                                className="rounded-none border-2 border-black w-12 h-12 flex-shrink-0"
                                style={{
                                  backgroundColor: ACCENT_COLOR,
                                  color: '#fff'
                                }}
                              >
                                <Play className="w-5 h-5" fill="currentColor" />
                              </Button>

                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-lg mb-1 truncate">{track.title}</h4>
                                <p className="text-sm text-gray-400 font-mono truncate">{track.artist}</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full rounded-full"
                                      style={{ 
                                        width: '0%',
                                        backgroundColor: ACCENT_COLOR 
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-mono text-gray-500">{track.duration}</span>
                                </div>
                              </div>
                            </div>

                            {/* Tape Label */}
                            <div 
                              className="absolute bottom-2 left-2 right-2 h-8 border-2 border-black/20 flex items-center justify-center"
                              style={{ backgroundColor: `${ACCENT_COLOR}15` }}
                            >
                              <span className="text-xs font-mono opacity-50">TRACK {String(index + 1).padStart(2, '0')}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a1a;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${ACCENT_COLOR};
          border: 2px solid #000;
        }
      `}</style>
    </div>
  )
}
