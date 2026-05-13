import type { Client, TextChannel } from 'discord.js'
import { fetchAds, markAdPosted } from './api.js'
import type { Ad } from './api.js'
import { buildAdEmbed } from './formatter.js'
import { checkInscriptions } from './inscription.js'

const POLL_INTERVAL_MS = 60 * 1000

let timer: ReturnType<typeof setTimeout> | null = null

function isDue(ad: Ad, now: Date): boolean {
  const last = ad.lastPostedAt ? new Date(ad.lastPostedAt) : null

  switch (ad.scheduleType) {
    case 'once':
      return last === null

    case 'minutes': {
      if (!ad.scheduleInterval) return false
      if (!last) return true
      return now.getTime() - last.getTime() >= ad.scheduleInterval * 60 * 1000
    }

    case 'hours': {
      if (!ad.scheduleInterval) return false
      if (!last) return true
      return now.getTime() - last.getTime() >= ad.scheduleInterval * 3600 * 1000
    }

    case 'days': {
      if (!ad.scheduleInterval) return false
      if (!last) return true
      return now.getTime() - last.getTime() >= ad.scheduleInterval * 86400 * 1000
    }

    case 'daily_time': {
      if (!ad.scheduleTime) return false
      const [hh, mm] = ad.scheduleTime.split(':').map(Number)
      const todayTarget = new Date(now)
      todayTarget.setHours(hh, mm, 0, 0)
      if (now < todayTarget) return false
      if (last && last >= todayTarget) return false
      return true
    }

    case 'specific_dates': {
      if (!ad.scheduleDates || ad.scheduleDates.length === 0) return false
      for (const dateStr of ad.scheduleDates) {
        const target = new Date(dateStr)
        if (isNaN(target.getTime())) continue
        if (target <= now && (!last || last < target)) return true
      }
      return false
    }

    default:
      return false
  }
}

async function tick(client: Client): Promise<void> {
  const channelId = process.env.DISCORD_CHANNEL_ID
  if (!channelId) {
    console.warn('[scheduler] DISCORD_CHANNEL_ID não configurado, pulando.')
    return
  }

  let ads: Ad[]
  try {
    ads = await fetchAds()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[scheduler] API indisponível: ${message}`)
    return
  }

  const now = new Date()
  const due = ads.filter(ad => isDue(ad, now))

  if (due.length === 0) return

  let channel: TextChannel
  try {
    const ch = await client.channels.fetch(channelId)
    if (!ch || !ch.isTextBased()) {
      console.error(`[scheduler] Canal ${channelId} não encontrado ou não é de texto.`)
      return
    }
    channel = ch as TextChannel
  } catch (err) {
    console.error(`[scheduler] Erro ao buscar canal ${channelId}:`, err)
    return
  }

  for (const ad of due) {
    try {
      await channel.send({ embeds: [buildAdEmbed(ad)] })
      console.log(`[scheduler] Anúncio #${ad.id} "${ad.title}" enviado para #${channel.name}`)
      await markAdPosted(ad.id)
    } catch (err) {
      console.error(`[scheduler] Erro ao enviar anúncio #${ad.id}:`, err)
    }
  }
}

export function startScheduler(client: Client): void {
  async function loop(): Promise<void> {
    await tick(client)
    await checkInscriptions(client)
    timer = setTimeout(loop, POLL_INTERVAL_MS)
  }
  loop()
}

export function stopScheduler(): void {
  if (timer !== null) {
    clearTimeout(timer)
    timer = null
  }
}
