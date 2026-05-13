import { EmbedBuilder } from 'discord.js'
import type { Ad } from './api.js'

export function buildAdEmbed(ad: Ad): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x61afef)
    .setTitle(ad.title)
    .setDescription(ad.message)
    .setTimestamp()
    .setFooter({ text: 'PacketLoss • packetloss.com.br' })
}
