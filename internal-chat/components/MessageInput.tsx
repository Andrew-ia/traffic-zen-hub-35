import { useState, useRef } from "react"
import { Send, Image as ImageIcon, Loader2 } from "lucide-react"
import { sendMessage, uploadImage } from "../lib/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function MessageInput({ roomId, me }: { roomId: string; me: string }) {
  const [text, setText] = useState("")
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSend() {
    if (!text.trim()) return
    try {
      await sendMessage(roomId, me, text)
      setText("")
    } catch (error) {
      toast.error("Erro ao enviar mensagem")
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const publicUrl = await uploadImage(file)
      if (publicUrl) {
        await sendMessage(roomId, me, "", publicUrl)
      }
    } catch (error) {
      toast.error("Erro ao enviar imagem")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="p-4 border-t border-border bg-card">
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFile}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="shrink-0"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
        </Button>
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Digite sua mensagem..."
          className="flex-1"
        />
        <Button onClick={handleSend} size="icon" disabled={!text.trim() || uploading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
