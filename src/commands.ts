import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  TextChannel,
  type Client,
  type Message,
} from 'discord.js'
import {
  finishLobby,
  getActiveMatch,
  getInscriptionByChannel,
  setMatchMessage,
  startDraft,
  type LobbyEntry,
  type MatchData,
} from './api.js'

function buildDraftEmbed(match: MatchData, inscriptionTitle: string): object {
  const embed = new EmbedBuilder()
    .setColor(0x61afef)
    .setTitle(`🎮 Draft iniciado — ${inscriptionTitle}`)
    .setTimestamp()
    .setFooter({ text: 'PacketLoss • packetloss.com.br' })

  for (const lobby of match.lobbies) {
    const playerList =
      lobby.players.length === 0
        ? '_Nenhum jogador_'
        : lobby.players.map((p, i) => `${i + 1}. ${p.displayName}`).join('\n')
    embed.addFields({ name: `Lobby ${lobby.number} (${lobby.players.length}/10)`, value: playerList, inline: true })
  }

  if (match.suplentes.length > 0) {
    const suplList = match.suplentes.map((p) => p.displayName).join(', ')
    embed.addFields({ name: `Suplentes (${match.suplentes.length})`, value: suplList })
  }

  return { embeds: [embed] }
}

function buildTerminarRow(matchId: number, lobbies: LobbyEntry[]): object {
  if (lobbies.length === 0) return { components: [] }

  const buttons = lobbies.slice(0, 5).map((l) =>
    new ButtonBuilder()
      .setCustomId(`match:finish:${matchId}:${l.number}`)
      .setLabel(`Terminar Lobby ${l.number}`)
      .setStyle(ButtonStyle.Secondary),
  )

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons)
  return { components: [row] }
}

export async function handleDraftCommand(message: Message, _client: Client): Promise<void> {
  const channelId = message.channelId

  const inscription = await getInscriptionByChannel(channelId).catch(() => null)
  if (!inscription) {
    await message.reply('Nenhuma inscrição encerrada encontrada neste canal.')
    return
  }

  let match: MatchData
  try {
    match = await startDraft(inscription.id)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Draft já iniciado')) {
      const existing = await getActiveMatch(channelId).catch(() => null)
      if (existing) {
        await message.reply('Draft já iniciado para esta inscrição.')
        return
      }
    }
    await message.reply(`Erro ao iniciar draft: ${msg}`)
    return
  }

  const ch = message.channel as TextChannel
  const sent = await ch.send({
    ...buildDraftEmbed(match, inscription.title),
    ...buildTerminarRow(match.id, match.lobbies),
  } as Parameters<typeof ch.send>[0])

  await setMatchMessage(match.id, sent.id).catch(() => null)
}

export async function handleTerminarCommand(message: Message, args: string[]): Promise<void> {
  const channelId = message.channelId

  const match = await getActiveMatch(channelId).catch(() => null)
  if (!match) {
    await message.reply('Nenhuma partida ativa encontrada neste canal. Use `!draft` para iniciar.')
    return
  }

  const lobbyNumber = args[0] ? Number(args[0]) : match.lobbies[0]?.number
  if (!lobbyNumber || !Number.isInteger(lobbyNumber)) {
    const available = match.lobbies.map((l) => l.number).join(', ')
    await message.reply(
      `Especifique o número do lobby: \`!terminar <número>\`\nLobbies disponíveis: ${available}`,
    )
    return
  }

  let result: { lobbyResultId: number; scoreUrl: string }
  try {
    result = await finishLobby(match.id, lobbyNumber)
  } catch (err) {
    await message.reply(`Erro ao terminar lobby: ${err instanceof Error ? err.message : String(err)}`)
    return
  }

  const embed = new EmbedBuilder()
    .setColor(0x00e5c7)
    .setTitle(`✅ Lobby ${lobbyNumber} encerrado`)
    .setDescription(
      `Registre as pontuações dos jogadores no link abaixo:\n\n**[→ Preencher Pontuações](${result.scoreUrl})**`,
    )
    .setTimestamp()
    .setFooter({ text: 'PacketLoss • packetloss.com.br' })

  await (message.channel as TextChannel).send({ embeds: [embed] })
}

export async function handleMatchFinishButton(
  interaction: import('discord.js').ButtonInteraction,
): Promise<void> {
  const parts = interaction.customId.split(':')
  const matchId = Number(parts[2])
  const lobbyNumber = Number(parts[3])

  if (!Number.isInteger(matchId) || !Number.isInteger(lobbyNumber)) return

  await interaction.deferReply({ flags: MessageFlags.Ephemeral })

  let result: { lobbyResultId: number; scoreUrl: string }
  try {
    result = await finishLobby(matchId, lobbyNumber)
  } catch (err) {
    await interaction.editReply(`Erro: ${err instanceof Error ? err.message : String(err)}`)
    return
  }

  const embed = new EmbedBuilder()
    .setColor(0x00e5c7)
    .setTitle(`✅ Lobby ${lobbyNumber} encerrado`)
    .setDescription(
      `Registre as pontuações dos jogadores:\n\n**[→ Preencher Pontuações](${result.scoreUrl})**`,
    )
    .setTimestamp()
    .setFooter({ text: 'PacketLoss • packetloss.com.br' })

  if (interaction.channel && 'send' in interaction.channel) {
    await (interaction.channel as TextChannel).send({ embeds: [embed] })
  }
  await interaction.editReply('Lobby encerrado!')
}
