"use client"
// components/HriInput.tsx
// The protagonist. One input. The whole experience.

import {
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react"

interface HriInputProps {
  value:       string
  onChange:    (v: string) => void
  onSubmit:    () => void
  placeholder?: string
  disabled?:   boolean
  autoFocus?:  boolean
}

export default function HriInput({
  value,
  onChange,
  onSubmit,
  placeholder = "지금 떠오르는 생각을 적어보세요",
  disabled = false,
  autoFocus = true,
}: HriInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to content
  const resize = useCallback(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
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
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) onSubmit()
    }
  }

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value)
    resize()
  }

  return (
    <div className="input-row">
      <div className="input-wrap">
        <textarea
  style={{
    minHeight: "140px",
    padding: "22px",
    fontSize: "20px",
    lineHeight: "1.7",
    borderRadius: "20px",
    border: "2px solid #111111",
    boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
    background: "#ffffff",
  }}
          ref={ref}
          className="hri-input"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKey}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          aria-label="입력창"
          aria-multiline="true"
        />
      </div>
      <p className={`enter-hint${value.trim() ? " visible" : ""}`}>
        Enter로 계속하기 · Shift+Enter로 줄바꿈
      </p>
    </div>
  )
}
