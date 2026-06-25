"use client";

import { useEffect, useRef, useCallback } from "react";

interface YouTubePlayerProps {
  videoId: string;
  startedAt: string | null;
  durationSeconds: number | null;
  isPaused: boolean;
  onEnded: () => void;
}

declare global {
  interface Window {
    YT: {
      Player: new (
        element: HTMLElement,
        config: {
          videoId: string;
          playerVars: Record<string, number | string>;
          events: {
            onReady: (event: { target: YTPlayer }) => void;
            onStateChange: (event: { data: number; target: YTPlayer }) => void;
          };
        }
      ) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

let apiLoaded = false;
let apiLoading = false;
const loadCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded) return Promise.resolve();
  return new Promise((resolve) => {
    if (apiLoading) {
      loadCallbacks.push(resolve);
      return;
    }
    apiLoading = true;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(tag);
  });
}

/** Hidden audio-only YouTube player — controls playback without showing video. */
export function YouTubePlayer({
  videoId,
  startedAt,
  durationSeconds,
  isPaused,
  onEnded,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const initPlayer = useCallback(async () => {
    if (!containerRef.current || !videoId) return;

    await loadYouTubeAPI();

    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        fs: 0,
      },
      events: {
        onReady: (event) => {
          if (startedAt) {
            const elapsed =
              (Date.now() - new Date(startedAt).getTime()) / 1000;
            if (elapsed > 0) {
              event.target.seekTo(elapsed, true);
            }
          }
          if (!isPaused) {
            event.target.playVideo();
          }
        },
        onStateChange: (event) => {
          if (event.data === window.YT.PlayerState.ENDED) {
            onEndedRef.current();
          }
        },
      },
    });
  }, [videoId, startedAt, isPaused]);

  useEffect(() => {
    initPlayer();
    return () => {
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [initPlayer]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (isPaused) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isPaused]);

  useEffect(() => {
    if (!startedAt || !durationSeconds) return;

    const elapsed = (Date.now() - new Date(startedAt).getTime()) / 1000;
    const remaining = (durationSeconds - elapsed) * 1000;

    if (remaining <= 0) {
      onEndedRef.current();
      return;
    }

    const timer = setTimeout(() => {
      onEndedRef.current();
    }, remaining + 2000);

    return () => clearTimeout(timer);
  }, [startedAt, durationSeconds, videoId]);

  return (
    <div
      className="fixed w-px h-px overflow-hidden opacity-0 pointer-events-none"
      style={{ left: -9999, top: -9999 }}
      aria-hidden
    >
      <div ref={containerRef} />
    </div>
  );
}
