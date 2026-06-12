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
  const res = await fetch(`${baseUrl()}/bot/advertisement`, {
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
  const res = await fetch(`${baseUrl()}/packetads/${id}/posted`, {
    method: 'PATCH',
    headers: authHeaders(),
  })

  if (!res.ok) {
    console.warn(`[api] Falha ao marcar anúncio #${id} como postado: ${res.status}`)
  }
}

// ─── Inscription API ──────────────────────────────────────────────────────────

export type Participant = {
  discordId: string
  displayName: string
  joinedAt: string
}

export type InscriptionData = {
  id: number
  title: string
  description: string | null
  channelId: string | null
  messageId: string | null
  participants: Participant[]
  maxParticipants: number | null
  expiresAt: string | null
}

export type InscriptionQueue = {
  toPost: InscriptionData[]
  toClose: InscriptionData[]
}

export async function fetchInscriptionQueue(): Promise<InscriptionQueue> {
  const res = await fetch(`${baseUrl()}/bot/inscription`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`API retornou ${res.status} ao buscar inscrições`)
  return res.json() as Promise<InscriptionQueue>
}

export async function setInscriptionMessage(id: number, messageId: string): Promise<void> {
  await fetch(`${baseUrl()}/bot/inscription/${id}/message`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  })
}

export async function joinInscription(
  id: number,
  discordId: string,
  displayName: string,
): Promise<{ ok: boolean; participants: Participant[]; error?: string }> {
  const res = await fetch(`${baseUrl()}/bot/inscription/${id}/join`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId, displayName }),
  })
  return res.json()
}

export async function leaveInscription(
  id: number,
  discordId: string,
): Promise<{ ok: boolean; participants: Participant[]; error?: string }> {
  const res = await fetch(`${baseUrl()}/bot/inscription/${id}/leave`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ discordId }),
  })
  return res.json()
}

export async function closeInscription(id: number): Promise<void> {
  await fetch(`${baseUrl()}/bot/inscription/${id}/close`, {
    method: 'PATCH',
    headers: authHeaders(),
  })
}

export async function mockFillInscription(id: number): Promise<{ ok: boolean; participants: Participant[] }> {
  const res = await fetch(`${baseUrl()}/bot/inscription/${id}/mock`, {
    method: 'POST',
    headers: authHeaders(),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API retornou ${res.status} ao preencher inscrição com mocks: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// ─── Match / Draft API ────────────────────────────────────────────────────────

export type LobbyEntry = {
  number: number
  players: Participant[]
}

export type MatchData = {
  id: number
  inscriptionId: number | null
  lobbies: LobbyEntry[]
  suplentes: Participant[]
  channelId: string | null
  messageId: string | null
  status: 'draft' | 'active' | 'finished'
}

export async function startDraft(inscriptionId: number): Promise<MatchData> {
  const res = await fetch(`${baseUrl()}/bot/match`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ inscriptionId }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API retornou ${res.status} ao iniciar draft: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<MatchData>
}

export async function getActiveMatch(channelId: string): Promise<MatchData | null> {
  const res = await fetch(`${baseUrl()}/bot/match?channelId=${encodeURIComponent(channelId)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API retornou ${res.status} ao buscar partida ativa`)
  return res.json() as Promise<MatchData>
}

export async function finishLobby(
  matchId: number,
  lobbyNumber: number,
): Promise<{ lobbyResultId: number; scoreUrl: string }> {
  const res = await fetch(`${baseUrl()}/bot/match/${matchId}/finish`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ lobbyNumber }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API retornou ${res.status} ao terminar lobby: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<{ lobbyResultId: number; scoreUrl: string }>
}

export async function setMatchMessage(matchId: number, messageId: string): Promise<void> {
  await fetch(`${baseUrl()}/bot/match/${matchId}/message`, {
    method: 'PATCH',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageId }),
  })
}

export async function getInscriptionByChannel(channelId: string): Promise<InscriptionData | null> {
  const res = await fetch(`${baseUrl()}/bot/inscription?channelId=${encodeURIComponent(channelId)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) return null
  return res.json() as Promise<InscriptionData | null>
}
