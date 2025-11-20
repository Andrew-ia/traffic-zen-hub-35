import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function MessageBubble({ message, me }: { message: any; me: string }) {
  const mine = message.sender_id === me
  const time = message.created_at ? format(new Date(message.created_at), 'HH:mm') : ''

  return (
    <div className={`flex w-full gap-2 mb-4 ${mine ? 'justify-end' : 'justify-start'}`}>
      {!mine && (
        <Avatar className="h-8 w-8 mt-1">
          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${message.sender_id}`} />
          <AvatarFallback>{message.sender_name?.[0] || '?'}</AvatarFallback>
        </Avatar>
      )}

      <div className={`flex flex-col max-w-[75%] ${mine ? 'items-end' : 'items-start'}`}>
        {!mine && <span className="text-[10px] text-muted-foreground ml-1 mb-1">{message.sender_name || 'Usuário'}</span>}

        <div
          className={`px-4 py-2 rounded-2xl shadow-sm ${mine
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border rounded-tl-sm'
            }`}
        >
          {message.image_url ? (
            <img src={message.image_url} alt="imagem" className="rounded-md max-h-64 object-cover" />
          ) : (
            <div className="text-sm whitespace-pre-wrap break-words">{message.content}</div>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground mt-1 px-1">
          {time}
        </span>
      </div>
    </div>
  )
}