"use client";

import { useEffect, useState } from "react";

// Voice Debug (diagnostic only) — enabled solely by `?voicedebug=1` in
// the page URL. Records the raw Web Speech event sequence so the Android
// repeated-transcript bug can be traced event by event on a real device.
// Purely observational: nothing here changes recognition, transcript,
// restart or submit behavior, and without the query param every export
// below is a no-op (vlog returns immediately, the overlay renders null).

const MAX_ENTRIES = 3000;

let enabledCache: boolean | null = null;
export function isVoiceDebug(): boolean {
  if (typeof window === "undefined") return false;
  if (enabledCache === null) {
    try {
      enabledCache = new URLSearchParams(window.location.search).get("voicedebug") === "1";
    } catch {
      enabledCache = false;
    }
  }
  return enabledCache;
}

const entries: string[] = [];
const listeners = new Set<() => void>();
let t0 = 0;

/** Append one log line: "+ms  message". No-op unless ?voicedebug=1. */
export function vlog(message: string): void {
  if (!isVoiceDebug()) return;
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (t0 === 0) {
    t0 = now;
    entries.push(`UA ${typeof navigator !== "undefined" ? navigator.userAgent : "?"}`);
  }
  entries.push(`+${Math.round(now - t0)}  ${message}`);
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  listeners.forEach((l) => l());
}

/** Quote a transcript so leading/trailing spaces and repeats are visible. */
export function vq(s: string): string {
  return JSON.stringify(s);
}

export default function VoiceDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [, setTick] = useState(0);
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isVoiceDebug()) return;
    setEnabled(true);
    const l = () => setTick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  if (!enabled) return null;

  const text = entries.join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — the textarea below is still selectable.
    }
  };

  const btn: React.CSSProperties = {
    fontSize: 12,
    padding: "4px 8px",
    marginLeft: 6,
    background: "#333",
    color: "#fff",
    border: "1px solid #888",
    borderRadius: 4,
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        background: "rgba(0,0,0,0.88)",
        color: "#9f9",
        fontFamily: "monospace",
        fontSize: 11,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", padding: "4px 8px" }}>
        <span style={{ flex: 1 }}>VOICE DEBUG ({entries.length})</span>
        <button type="button" style={btn} onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        <button
          type="button"
          style={btn}
          onClick={() => {
            entries.length = 0;
            t0 = 0;
            setTick((n) => n + 1);
          }}
        >
          Clear
        </button>
        <button type="button" style={btn} onClick={() => setOpen((o) => !o)}>{open ? "Hide" : "Show"}</button>
      </div>
      {open && (
        <textarea
          readOnly
          value={text}
          style={{
            display: "block",
            width: "100%",
            height: "35vh",
            background: "transparent",
            color: "inherit",
            border: "none",
            borderTop: "1px solid #444",
            fontFamily: "inherit",
            fontSize: "inherit",
            whiteSpace: "pre",
            overflow: "auto",
            resize: "none",
          }}
        />
      )}
    </div>
  );
}
