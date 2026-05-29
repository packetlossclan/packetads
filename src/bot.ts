import 'dotenv/config'
import { Client, Events, GatewayIntentBits } from 'discord.js'
import { startScheduler, stopScheduler } from './scheduler.js'
import { handleInscriptionButton } from './inscription.js'

const { DISCORD_TOKEN } = process.env

if (!DISCORD_TOKEN) throw new Error('DISCORD_TOKEN não definido no .env')

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
})

client.once(Events.ClientReady, (c) => {
  console.log(`[PacketAds] Conectado como ${c.user.tag}`)
  startScheduler(client)
})

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return
  if (!interaction.customId.startsWith('inscricao:')) return

  try {
    await handleInscriptionButton(interaction)
  } catch (err) {
    console.error('[bot] Erro ao processar interação de inscrição:', err)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Ocorreu um erro. Tente novamente.', ephemeral: true }).catch(() => null)
    }
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
