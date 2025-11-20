import { useEffect, useState } from "react"
import ChatSidebar from "../../internal-chat/components/ChatSidebar"
import ChatWindow from "../../internal-chat/components/ChatWindow"
import MessageInput from "../../internal-chat/components/MessageInput"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/lib/supabaseClient"
import { useResponsive } from "@/hooks/use-responsive"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function InternalChat() {
  const { user } = useAuth()
  const { isMobile } = useResponsive()
  const [userId, setUserId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [roomName, setRoomName] = useState<string>("")

  useEffect(() => {
    setUserId(user?.id ?? null)
  }, [user?.id])

  useEffect(() => {
    if (!roomId) return
      ; (async () => {
        try {
          const { data } = await supabase.from('rooms').select('name').eq('id', roomId).single()
          setRoomName(data?.name || 'Conversa')
        } catch {
          setRoomName('Conversa')
        }
      })()
  }, [roomId])

  if (!userId) return <div className="p-6 text-sm">Faça login para usar o chat.</div>

  if (isMobile) {
    return (
      <div className="h-[calc(100dvh-4rem)] bg-gray-50 dark:bg-neutral-900 text-foreground flex flex-col">
        {!roomId ? (
          <ChatSidebar userId={userId} currentRoomId={roomId || undefined} onSelect={setRoomId} />
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-4 py-2 border-b border-border bg-card flex items-center gap-2 sticky top-0 z-20">
              <Button variant="ghost" size="icon" onClick={() => setRoomId(null)} className="-ml-2">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-semibold truncate">{roomName}</span>
            </div>
            <ChatWindow roomId={roomId} roomName={roomName} me={userId} hideHeader />
            <MessageInput roomId={roomId} me={userId} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-5rem)] bg-gray-50 dark:bg-neutral-900 text-foreground grid grid-cols-[280px_1fr]">
      <ChatSidebar userId={userId} currentRoomId={roomId || undefined} onSelect={setRoomId} />
      <div className="flex flex-col min-w-0">
        {roomId ? (
          <>
            <ChatWindow roomId={roomId} roomName={roomName} me={userId} />
            <MessageInput roomId={roomId} me={userId} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Selecione uma sala</div>
        )}
      </div>
    </div>
  )
}