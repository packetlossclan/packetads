export type ScheduleType = 'minutes' | 'hours' | 'days' | 'once' | 'daily_time' | 'specific_dates'

export type Ad = {
  id: number
  title: string
  message: string
  scheduleType: ScheduleType
  scheduleInterval: number | null
  scheduleTime: string | null
  scheduleDates: string[] | null
  lastPostedAt: string | null
  startsAt: string | null
  expiresAt: string | null
}

function authHeaders(): Record<string, string> {
  const token = process.env.BOT_API_TOKEN
  if (!token) throw new Error('BOT_API_TOKEN não definido no .env')
  return { Authorization: `Bearer ${token}` }
}

function baseUrl(): string {
  const url = process.env.PACKETLOSS_API_URL
  if (!url) throw new Error('PACKETLOSS_API_URL não definido no .env')
  return url
}

export async function fetchAds(): Promise<Ad[]> {
  const res = await fetch(`${baseUrl()}/api/bot/advertisement`, {
    headers: authHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const contentType = res.headers.get('content-type') ?? ''
    const body = contentType.includes('application/json') ? await res.text() : ''
    const detail = body ? `: ${body.slice(0, 200)}` : ''
    throw new Error(`API retornou ${res.status} ${res.statusText}${detail}`)
  }

  return res.json() as Promise<Ad[]>
}

export async function markAdPosted(id: number): Promise<void> {
  const res = await fetch(`${baseUrl()}/api/packetads/${id}/posted`, {
    method: 'PATCH',
    headers: authHeaders(),
  })

  if (!res.ok) {
    console.warn(`[api] Falha ao marcar anúncio #${id} como postado: ${res.status}`)
  }
}
