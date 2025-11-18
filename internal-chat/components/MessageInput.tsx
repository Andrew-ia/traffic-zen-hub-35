"use client"
import { useEffect, useRef, useState } from "react"
import { sendMessage, uploadImage, typingChannel } from "../lib/chat"

export default function MessageInput({ roomId, me }: { roomId: string; me: string }) {
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const chanRef = useRef<any>(null)

  useEffect(() => {
    const chan = typingChannel(roomId)
    chan.on('presence', { event: 'sync' }, () => {
      const state = chan.presenceState()
      const users = Object.keys(state || {})
      setTypingUsers(users.filter((u) => u !== me))
    })
    chan.on('broadcast', { event: 'typing' }, (_payload) => {})
    chan.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        chan.track({ user: me })
      }
    })
    chanRef.current = chan
    return () => { chan.unsubscribe() }
  }, [roomId, me])

  useEffect(() => {
    const el = taRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [text])

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    console.log('[MessageInput] Sending message', { roomId, me, content: text.trim() })
    await sendMessage(roomId, me, text.trim())
    console.log('[MessageInput] Message sent')
    setText("")
    setSending(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSending(true)
    const url = await uploadImage(file)
    console.log('[MessageInput] Upload image URL', url)
    await sendMessage(roomId, me, '', url)
    setSending(false)
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    try {
      chanRef.current?.send({ type: 'broadcast', event: 'typing', payload: { user: me } })
    } catch {}
  }

  return (
    <div className="border-t border-border p-2 bg-card sticky bottom-0 z-20">
      {!roomId && (
        <div className="text-xs text-muted-foreground px-1 pb-1">Selecione um contato para começar a conversar.</div>
      )}
      {typingUsers.length > 0 && (
        <div className="text-xs text-muted-foreground px-1 pb-1">{typingUsers.join(', ')} digitando...</div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          value={text}
          onChange={onChange}
          placeholder="Escreva uma mensagem"
          className="flex-1 rounded-md bg-muted px-3 py-2 text-sm focus:outline-none resize-none"
        />
        <label className="text-xs px-2 py-2 rounded bg-muted cursor-pointer">
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
          📷
        </label>
        <button onClick={handleSend} disabled={sending} className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm">
          Enviar
        </button>
      </div>
    </div>
  )
}