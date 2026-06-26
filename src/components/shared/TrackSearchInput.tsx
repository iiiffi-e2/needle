"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { YouTubeSearchResult } from "@/lib/youtube-search-cache";
import { cn } from "@/lib/utils";

export interface TrackSearchInputProps {
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  onSelect: (videoId: string, url: string) => void;
  showSaveAction?: boolean;
  onSave?: (videoId: string, url: string) => void;
  isDj?: boolean;
  autoFocus?: boolean;
}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function TrackSearchInput({
  placeholder = "Search for a track or paste a YouTube link…",
  disabled = false,
  inputClassName,
  onSelect,
  showSaveAction = false,
  onSave,
  isDj = false,
  autoFocus = false,
}: TrackSearchInputProps) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedVideoId = value.trim() ? parseYouTubeUrl(value) : null;
  const isUrlMode = Boolean(parsedVideoId);

  const runSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setError(data.error || "Search unavailable");
        setOpen(true);
        return;
      }
      setResults(data.results ?? []);
      setOpen(true);
      setHighlightIndex(data.results?.length ? 0 : -1);
    } catch {
      setResults([]);
      setError("Search unavailable — paste a link instead");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setError("");
      setOpen(false);
      return;
    }

    if (parseYouTubeUrl(trimmed)) {
      setResults([]);
      setError("");
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const pick = (videoId: string) => {
    const url = watchUrl(videoId);
    setValue("");
    setOpen(false);
    setResults([]);
    onSelect(videoId, url);
  };

  const handleSave = (videoId: string) => {
    onSave?.(videoId, watchUrl(videoId));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (parsedVideoId) {
        pick(parsedVideoId);
        return;
      }
      if (highlightIndex >= 0 && results[highlightIndex]) {
        pick(results[highlightIndex].videoId);
      }
      return;
    }

    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length || error) setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cn(
          "flex-1 min-w-0 bg-transparent border-none outline-none disabled:opacity-50",
          inputClassName
        )}
        style={{ color: "var(--txt)", fontSize: 13 }}
      />

      {open && (loading || error || results.length > 0) && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-xl overflow-hidden border shadow-lg"
          style={{
            borderColor: "var(--line)",
            background: "var(--card, #1c120b)",
            maxHeight: 320,
          }}
        >
          {loading && (
            <div className="px-3 py-2 text-[12px]" style={{ color: "var(--sub)" }}>
              Searching…
            </div>
          )}

          {!loading && error && (
            <div className="px-3 py-2 text-[12px]" style={{ color: "var(--sub)" }}>
              {error}
            </div>
          )}

          {!loading &&
            results.map((r, i) => (
              <div
                key={r.videoId}
                role="option"
                aria-selected={i === highlightIndex}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 cursor-pointer",
                  i === highlightIndex && "bg-[#ffffff12]"
                )}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <button
                  type="button"
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
                  style={{ color: "var(--txt)" }}
                  onClick={() => pick(r.videoId)}
                >
                  <span
                    className="w-10 h-10 rounded-lg shrink-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${r.thumbnailUrl})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate">
                      {r.title}
                    </span>
                    <span
                      className="block text-[11px] truncate"
                      style={{ color: "var(--sub)" }}
                    >
                      {r.channelTitle}
                    </span>
                  </span>
                </button>
                {showSaveAction && onSave && (
                  <button
                    type="button"
                    title="Save to crate"
                    aria-label="Save to crate"
                    onClick={() => handleSave(r.videoId)}
                    className="shrink-0 w-8 h-8 rounded-lg border-none cursor-pointer text-sm"
                    style={{
                      background: "#ffffff14",
                      color: "var(--txt)",
                    }}
                  >
                    ♥
                  </button>
                )}
                {showSaveAction && isDj && (
                  <button
                    type="button"
                    title="Drop track"
                    aria-label="Drop track"
                    onClick={() => pick(r.videoId)}
                    className="shrink-0 w-8 h-8 rounded-lg border-none cursor-pointer text-sm font-extrabold"
                    style={{
                      background:
                        "linear-gradient(120deg, var(--glow2), var(--glow))",
                      color: "#1a0d06",
                    }}
                  >
                    +
                  </button>
                )}
              </div>
            ))}

          {!loading && results.length > 0 && (
            <div
              className="px-3 py-1.5 text-[10px] border-t"
              style={{ color: "var(--sub)", borderColor: "var(--line)" }}
            >
              Powered by YouTube
            </div>
          )}
        </div>
      )}
    </div>
  );
}
