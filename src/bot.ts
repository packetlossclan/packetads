import 'dotenv/config'
import { Client, Events, GatewayIntentBits, MessageFlags } from 'discord.js'
import { startScheduler, stopScheduler } from './scheduler.js'
import { handleInscriptionButton } from './inscription.js'
import { handleDraftCommand, handleMatchFinishButton, handleTerminarCommand } from './commands.js'

const { DISCORD_TOKEN } = process.env

if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não definido no .env')

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once(Events.ClientReady, (c) => {
  console.log(`[PacketAds] Conectado como ${c.user.tag}`)
  startScheduler(client)
})

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return
  const content = message.content.trim()
  if (!content.startsWith('!')) return

  const [command, ...args] = content.slice(1).split(/\s+/)

  if (command === 'draft') {
    try {
      await handleDraftCommand(message, client)
    } catch (err) {
      console.error('[bot] Erro ao processar !draft:', err)
      await message.reply('Ocorreu um erro ao iniciar o draft.').catch(() => null)
    }
    return
  }

  if (command === 'terminar') {
    try {
      await handleTerminarCommand(message, args)
    } catch (err) {
      console.error('[bot] Erro ao processar !terminar:', err)
      await message.reply('Ocorreu um erro ao terminar o lobby.').catch(() => null)
    }
    return
  }
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return

  if (interaction.customId.startsWith('inscricao:')) {
    try {
      await handleInscriptionButton(interaction)
    } catch (err) {
      console.error('[bot] Erro ao processar interação de inscrição:', err)
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Ocorreu um erro. Tente novamente.', flags: MessageFlags.Ephemeral }).catch(() => null)
      }
    }
    return
  }

  if (interaction.customId.startsWith('match:finish:')) {
    try {
      await handleMatchFinishButton(interaction)
    } catch (err) {
      console.error('[bot] Erro ao processar botão de terminar lobby:', err)
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Ocorreu um erro. Tente novamente.', flags: MessageFlags.Ephemeral }).catch(() => null)
      }
    }
    return
  }
})

process.on('SIGINT', () => {
  console.log('[PacketAds] Encerrando…')
  stopScheduler()
  client.destroy()
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('[PacketAds] Encerrando…')
  stopScheduler()
  client.destroy()
  process.exit(0)
})

client.login(DISCORD_TOKEN)
