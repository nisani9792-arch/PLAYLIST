import { useState, useRef } from 'react';
import { MsHit } from '../lib/meilisearch';

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentSong, setCurrentSong] = useState<MsHit | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const playSong = (song: MsHit) => {
    if (currentSong?.id === song.id && isPlaying) return;
    setCurrentSong(song);
    setCurrentTime(0);
    setDuration(0);
    if (!song.audio_url) {
      setIsPlaying(false);
      return;
    }
    setIsPlaying(true);
    if (audioRef.current) {
      audioRef.current.src = song.audio_url;
      audioRef.current.play().catch(e => console.error("Playback failed", e));
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentSong) return;
    if (!currentSong.audio_url) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(e => console.error("Playback failed", e));
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolume = (vol: number) => {
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
    setVolume(vol);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  return {
    audioRef,
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    playSong,
    togglePlay,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleSeek,
    handleVolume,
    handleEnded,
  };
}
