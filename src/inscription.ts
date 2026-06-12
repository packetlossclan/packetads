import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type TextChannel,
} from 'discord.js'
import {
  closeInscription,
  fetchInscriptionQueue,
  joinInscription,
  leaveInscription,
  mockFillInscription,
  setInscriptionMessage,
  type InscriptionData,
  type Participant,
} from './api.js'

const isDev = process.env.NODE_ENV !== 'production'

function buildMessage(
  insc: InscriptionData,
  participants: Participant[],
  closed: boolean,
) {
  const count = participants.length
  const max = insc.maxParticipants
  const countStr = max ? `${count}/${max}` : String(count)
  const isFull = max !== null && count >= max

  const listText =
    count === 0
      ? '_Nenhum inscrito ainda._'
      : participants.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n')

  const embed = new EmbedBuilder()
    .setColor(closed ? 0x555555 : 0x61afef)
    .setTitle(insc.title)
    .addFields({ name: `Participantes (${countStr})`, value: listText })
    .setTimestamp()
    .setFooter({ text: closed ? 'Inscrições encerradas · PacketLoss' : 'PacketLoss • packetloss.com.br' })

  if (insc.description) embed.setDescription(insc.description)

  if (closed) return { embeds: [embed], components: [] }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`inscricao:join:${insc.id}`)
      .setLabel('🔔 Inscrever-se')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(isFull),
    new ButtonBuilder()
      .setCustomId(`inscricao:leave:${insc.id}`)
      .setLabel('🚪 Sair da lista')
      .setStyle(ButtonStyle.Secondary),
  )

  if (isDev) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`inscricao:mock:${insc.id}`)
        .setLabel('🧪 Preencher (dev)')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(isFull),
    )
  }

  return { embeds: [embed], components: [row] }
}

async function getChannel(client: Client, channelId: string): Promise<TextChannel | null> {
  try {
    const ch = await client.channels.fetch(channelId)
    if (ch && ch.isTextBased()) return ch as TextChannel
  } catch { /* ignore */ }
  return null
}

export async function checkInscriptions(client: Client): Promise<void> {
  let queue
  try {
    queue = await fetchInscriptionQueue()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`[inscription] Falha ao buscar inscrições: ${msg}`)
    return
  }

  const defaultChannelId = process.env.INSCRICAO_CHANNEL_ID

  for (const insc of queue.toPost) {
    const channelId = insc.channelId ?? defaultChannelId
    if (!channelId) {
      console.warn(`[inscription] Inscrição #${insc.id} sem canal configurado, pulando.`)
      continue
    }

    const channel = await getChannel(client, channelId)
    if (!channel) {
      console.error(`[inscription] Canal ${channelId} não encontrado para inscrição #${insc.id}.`)
      continue
    }

    try {
      const msg = await channel.send(buildMessage(insc, insc.participants, false))
      await setInscriptionMessage(insc.id, msg.id)
      console.log(`[inscription] Inscrição #${insc.id} "${insc.title}" postada em #${channel.name}`)
    } catch (err) {
      console.error(`[inscription] Erro ao postar inscrição #${insc.id}:`, err)
    }
  }

  for (const insc of queue.toClose) {
    const channelId = insc.channelId ?? defaultChannelId
    if (!channelId || !insc.messageId) continue

    const channel = await getChannel(client, channelId)
    if (!channel) continue

    try {
      const msg = await channel.messages.fetch(insc.messageId)
      await msg.edit(buildMessage(insc, insc.participants, true))
      await closeInscription(insc.id)
      console.log(`[inscription] Inscrição #${insc.id} encerrada em #${channel.name}`)
    } catch (err) {
      console.error(`[inscription] Erro ao encerrar inscrição #${insc.id}:`, err)
    }
  }
}

export async function handleInscriptionButton(interaction: ButtonInteraction): Promise<void> {
  const [, action, idStr] = interaction.customId.split(':')
  const inscriptionId = Number(idStr)
  if (!Number.isInteger(inscriptionId) || inscriptionId <= 0) return

  const discordId = interaction.user.id
  const displayName =
    interaction.member instanceof GuildMember
      ? interaction.member.displayName
      : interaction.user.displayName

  if (action === 'join') {
    const result = await joinInscription(inscriptionId, discordId, displayName)

    if (!result.ok) {
      const msg =
        result.error === 'already_joined'
          ? 'Você já está inscrito!'
          : result.error === 'full'
            ? 'As vagas estão esgotadas!'
            : 'Não foi possível realizar a inscrição.'
      await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral })
      return
    }

    const insc: InscriptionData = {
      id: inscriptionId,
      title: interaction.message.embeds[0]?.title ?? '',
      description: interaction.message.embeds[0]?.description ?? null,
      channelId: null,
      messageId: interaction.message.id,
      participants: result.participants,
      maxParticipants: null,
      expiresAt: null,
    }

    await interaction.update(buildMessage(insc, result.participants, false))
    return
  }

  if (action === 'leave') {
    const result = await leaveInscription(inscriptionId, discordId)

    if (!result.ok) {
      await interaction.reply({ content: 'Você não está na lista de inscritos.', flags: MessageFlags.Ephemeral })
      return
    }

    const insc: InscriptionData = {
      id: inscriptionId,
      title: interaction.message.embeds[0]?.title ?? '',
      description: interaction.message.embeds[0]?.description ?? null,
      channelId: null,
      messageId: interaction.message.id,
      participants: result.participants,
      maxParticipants: null,
      expiresAt: null,
    }

    await interaction.update(buildMessage(insc, result.participants, false))
    return
  }

  if (action === 'mock') {
    if (!isDev) return

    const result = await mockFillInscription(inscriptionId)

    const insc: InscriptionData = {
      id: inscriptionId,
      title: interaction.message.embeds[0]?.title ?? '',
      description: interaction.message.embeds[0]?.description ?? null,
      channelId: null,
      messageId: interaction.message.id,
      participants: result.participants,
      maxParticipants: null,
      expiresAt: null,
    }

    await interaction.update(buildMessage(insc, result.participants, false))
  }
}
