"use client"
import { format } from 'date-fns'

export default function MessageBubble({ message, me }: { message: any; me: string }) {
  const mine = message.sender_id === me
  const time = message.created_at ? format(new Date(message.created_at), 'HH:mm') : ''
  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} px-2`}> 
      <div className={`max-w-[70%] rounded-2xl px-3 py-2 mb-2 ${mine ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted rounded-bl-sm'}`}>
        <div className="text-[10px] opacity-80">{message.sender_name || message.sender_id}</div>
        {message.image_url ? (
          <img src={message.image_url} alt="imagem" className="mt-1 rounded-md max-h-64 object-cover" />
        ) : (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        )}
        <div className="text-[10px] mt-1 opacity-70 text-right">{time}</div>
      </div>
    </div>
  )
}