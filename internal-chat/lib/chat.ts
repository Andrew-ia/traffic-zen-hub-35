import { supabase as supabaseClient } from '@/lib/supabaseClient'
export const supabase: any = supabaseClient

export async function getRooms(userId: string) {
  const { data } = await supabase
    .from('room_members')
    .select('room_id, rooms:room_id(id,name,created_at)')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })
  return (data || []).map((r: any) => r.rooms)
}

export async function getMessages(roomId: string, limit = 30, before?: string) {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) query = query.lt('created_at', before)
  const { data } = await query
  return (data || []).reverse()
}

export async function sendMessage(roomId: string, senderId: string, content: string, image?: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ room_id: roomId, sender_id: senderId, content, image_url: image })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export function subscribeToMessages(roomId: string, callback: (payload: any) => void) {
  const channel = supabase.channel(`room:${roomId}`, {
    config: {
      presence: { key: 'presence' },
      broadcast: { ack: true },
      postgres_changes: [{ event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }],
    },
  })
  channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => callback(payload.new))
  channel.subscribe()
  return channel
}

export async function createRoom(name: string, members: string[], workspaceId?: string) {
  const wsRaw = workspaceId || (import.meta as any).env?.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010'
  const ws = String(wsRaw).replace(/\r?\n/g, '').trim()
  const { data: room, error } = await supabase.from('rooms').insert({ name, workspace_id: ws }).select('*').single()
  if (error) throw error
  if (members?.length) {
    const payload = members.map((m) => ({ room_id: room.id, user_id: m }))
    const { error: rmError } = await supabase.from('room_members').insert(payload)
    if (rmError) {
      console.error('room_members insert failed', rmError.message)
    }
  }
  return room
}

export async function uploadImage(file: File) {
  const bucket = 'chat-images'
  const path = `${Date.now()}-${file.name}`
  await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  const { data } = await supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export function typingChannel(roomId: string) {
  return supabase.channel(`typing:${roomId}`, { config: { presence: { key: 'typing' }, broadcast: { ack: true } } })
}

export async function getWorkspaceMembers(workspaceId: string) {
  const ws = String(workspaceId || (import.meta as any).env?.VITE_WORKSPACE_ID || '').replace(/\r?\n/g, '').trim()
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id, role, invitation_status, users:user_id(id, email, full_name)')
    .eq('workspace_id', ws)
  if (error) {
    console.error('getWorkspaceMembers failed', error.message)
    return [] as Array<{ id: string; email?: string; full_name?: string }>
  }
  return (data || []).map((r: any) => ({ id: r.user_id, email: r.users?.email, full_name: r.users?.full_name }))
}

export async function findOrCreateDirectRoom(meId: string, otherId: string) {
  if (meId === otherId) return null
  const { data } = await supabase
    .from('room_members')
    .select('room_id, user_id')
    .in('user_id', [meId, otherId])
  const counts: Record<string, Set<string>> = {}
  for (const row of (data || [])) {
    const set = counts[row.room_id] || new Set<string>()
    set.add(row.user_id)
    counts[row.room_id] = set
  }
  const existing = Object.entries(counts).find(([, set]) => set.has(meId) && set.has(otherId))
  if (existing) return existing[0]

  const { data: otherUser } = await supabase
    .from('users')
    .select('id, full_name, email')
    .eq('id', otherId)
    .limit(1)
  const title = otherUser && otherUser.length ? (otherUser[0].full_name || otherUser[0].email || `DM`) : 'DM'
  const wsRaw = (import.meta as any).env?.VITE_WORKSPACE_ID || '00000000-0000-0000-0000-000000000010'
  const ws = String(wsRaw).replace(/\r?\n/g, '').trim()
  const room = await createRoom(title, [meId, otherId], ws)
  return room.id as string
}