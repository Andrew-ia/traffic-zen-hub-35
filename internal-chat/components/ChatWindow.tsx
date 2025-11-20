"use client"
import { useCallback, useEffect, useRef, useState } from "react"
import { getMessages, subscribeToMessages } from "../lib/chat"
import MessageBubble from "./MessageBubble"

export default function ChatWindow({ roomId, roomName, me, hideHeader = false }: { roomId: string; roomName: string; me: string; hideHeader?: boolean }) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [before, setBefore] = useState<string | undefined>(undefined)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const subRef = useRef<any>(null)

  const loadInitial = useCallback(async () => {
    setLoading(true)
    const list = await getMessages(roomId, 30)
    console.log('[ChatWindow] Initial messages loaded:', list.length)
    setMessages(list)
    setBefore(list.length ? list[0].created_at : undefined)
    setLoading(false)
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [roomId])

  async function loadMore() {
    const older = await getMessages(roomId, 30, before)
    if (older.length) {
      setMessages((prev) => [...older, ...prev])
      setBefore(older[0].created_at)
    }
  }

  useEffect(() => {
    loadInitial()
    const ch = subscribeToMessages(roomId, (msg) => {
      console.log('[ChatWindow] New message received:', msg)
      setMessages((prev) => [...prev, msg])
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
    })
    console.log('[ChatWindow] Subscribed to room channel:', roomId)
    subRef.current = ch
    return () => { ch.unsubscribe() }
  }, [roomId, loadInitial])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {!hideHeader && (
        <div className="px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
          <div className="text-sm font-semibold">{roomName}</div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto bg-muted/10 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">Carregando mensagens...</div>
        ) : (
          <div className="flex flex-col justify-end min-h-full">
            <div className="flex justify-center mb-4">
              <button onClick={loadMore} className="text-xs px-3 py-1 rounded-full bg-muted hover:bg-muted/80 transition-colors">
                Carregar anteriores
              </button>
            </div>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} me={me} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
