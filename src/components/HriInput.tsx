"use client"
// components/HriInput.tsx
// The standard input across the whole experience — one pill, one shape,
// used by both Arrival and Conversation. Not swapped for a different
// control once Conversation starts.

import {
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react"
import type { Locale } from "@/lib/hri/locale"
import { CONTENT } from "@/lib/i18n/content"

interface HriInputProps {
  value:       string
  onChange:    (v: string) => void
  onSubmit:    () => void
  placeholder?: string
  disabled?:   boolean
  autoFocus?:  boolean
  locale?:     Locale
}

export default function HriInput({
  value,
  onChange,
  onSubmit,
  placeholder,
  disabled = false,
  autoFocus = true,
  locale = "ko",
}: HriInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize: starts pill-height, grows with content up to a cap.
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [])

  useEffect(() => { resize() }, [value, resize])

  // Focus on mount or when re-enabled
  useEffect(() => {
    if (autoFocus && !disabled && ref.current) {
      ref.current.focus()
    }
  }, [disabled, autoFocus])

  // Enter = submit, Shift+Enter = newline
  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (value.trim()) onSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
  }

  const handleSubmitClick = () => {
    if (value.trim()) onSubmit()
  }

  return (
    <div className="hri-pill">
      <textarea
        ref={ref}
        className="hri-pill-input"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        aria-label={CONTENT[locale].input.textareaAria}
        aria-multiline="true"
      />
      <button
        type="button"
        className="hri-pill-submit"
        onClick={handleSubmitClick}
        disabled={disabled || !value.trim()}
        aria-label={CONTENT[locale].input.submitAria}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  )
}
