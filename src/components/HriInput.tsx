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
  placeholder,
  disabled = false,
  autoFocus = true,
}: HriInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea to content
 const resize = useCallback(() => {
  const el = ref.current
  if (!el) return

  el.style.height = "120px"
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
  width: "100%",
  height: "120px",
  minHeight: "120px",
  maxHeight: "120px",
  overflowY: "auto",
  resize: "none",
  boxSizing: "border-box",
  padding: "20px 22px",
  fontSize: "24px",
  fontWeight: 600,
  lineHeight: "1.55",
  borderRadius: "20px",
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
