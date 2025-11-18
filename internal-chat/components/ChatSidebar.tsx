"use client"
import { useEffect, useState } from "react"
import { getRooms, createRoom, supabase, getWorkspaceMembers, findOrCreateDirectRoom } from "../lib/chat"

const WORKSPACE_ID = (import.meta as any).env?.VITE_WORKSPACE_ID || "00000000-0000-0000-0000-000000000010"

export default function ChatSidebar({ userId, currentRoomId, onSelect }: { userId: string; currentRoomId?: string; onSelect: (roomId: string) => void }) {
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([])
  const [members, setMembers] = useState<Array<{ id: string; email?: string; full_name?: string }>>([])
  const [activeMember, setActiveMember] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      const list = await getRooms(userId)
      if (mounted) setRooms(list)
      const mem = await getWorkspaceMembers(WORKSPACE_ID)
      const filtered = mem.filter(m => m.id !== userId)
      if (mounted) setMembers(filtered)
      if (mounted && !currentRoomId && filtered.length > 0) {
        try {
          const rid = await findOrCreateDirectRoom(userId, filtered[0].id)
          if (rid) {
            setActiveMember(filtered[0].id)
            onSelect(rid)
          }
        } catch {}
      }
      setLoading(false)
    })()
    const channel = supabase.channel("rooms-list")
    channel.subscribe()
    return () => {
      mounted = false
      channel.unsubscribe()
    }
  }, [userId])

  // Salas desativadas para foco em conversas 1:1

  return (
    <div className="h-full w-[280px] border-r border-border bg-muted/30 flex flex-col">
      <div className="p-3">
        <span className="text-sm font-semibold">Conversas</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">Carregando...</div>
        ) : (
          <>
            <div className="px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">Diretas</div>
            <ul className="space-y-1 p-2">
              {members.map((m) => (
                <li key={m.id}>
                  <button
                    onClick={async () => {
                      const rid = await findOrCreateDirectRoom(userId, m.id)
                      if (rid) {
                        setActiveMember(m.id)
                        onSelect(rid)
                      }
                    }}
                    className={`w-full text-left px-3 py-2 rounded ${activeMember === m.id ? "bg-primary/10 font-medium" : "hover:bg-muted"}`}
                  >
                    {m.full_name || m.email || m.id}
                  </button>
                </li>
              ))}
            </ul>
            
          </>
        )}
      </div>
    </div>
  )
}