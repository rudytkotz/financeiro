import TelegramBot from 'node-telegram-bot-api'
import { eq, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '../db/index.js'
import { users, telegramLinks, transactions, dependents } from '../db/schema.js'

const PAYMENT_PREFIXES: Record<string, string> = {
  pix: 'pix',
  deb: 'debito',
  debito: 'debito',
  din: 'dinheiro',
  dinheiro: 'dinheiro',
  cred: 'credito',
  credito: 'credito',
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getCurrentDate(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/**
 * Parse a transaction message.
 * Formats:
 *   150,50 ifood
 *   150,50 ifood @maria
 *   pix 800 aluguel
 *   pix 800 aluguel @joao
 *   -50 reembolso uber
 *   deb 25,90 padaria @filho
 */
function parseMessage(text: string): { amount: number; description: string; paymentMethod: string; dependentName: string | null } | null {
  const parts = text.trim().split(/\s+/)
  if (parts.length < 2) return null

  let paymentMethod = 'credito'
  let startIdx = 0

  // Check if first word is a payment type prefix
  const firstLower = parts[0].toLowerCase()
  if (PAYMENT_PREFIXES[firstLower]) {
    paymentMethod = PAYMENT_PREFIXES[firstLower]
    startIdx = 1
  }

  if (parts.length <= startIdx) return null

  // Next part should be the amount
  const amountStr = parts[startIdx].replace(/\./g, '').replace(',', '.')
  const amount = Number(amountStr)
  if (isNaN(amount) || amount === 0) return null

  // Rest is description + optional @dependente
  const restParts = parts.slice(startIdx + 1)
  let dependentName: string | null = null
  const descParts: string[] = []

  for (const part of restParts) {
    if (part.startsWith('@')) {
      dependentName = part.slice(1) // remove @
    } else {
      descParts.push(part)
    }
  }

  const description = descParts.join(' ')
  if (!description) return null

  return {
    amount: Math.round(amount * 100),
    description,
    paymentMethod,
    dependentName,
  }
}

export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log('⚠️  TELEGRAM_BOT_TOKEN not set — bot disabled')
    return
  }

  const bot = new TelegramBot(token, { polling: true })
  console.log('🤖 Telegram bot started')

  // /start command
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `🏦 *Financeiro Bot*\n\n` +
      `Comandos:\n` +
      `• /vincular usuario senha — vincular conta\n` +
      `• /desvincular — remover vínculo\n` +
      `• /status — ver conta vinculada\n\n` +
      `Para lançar transação, envie:\n` +
      `• \`150,50 ifood\` — crédito\n` +
      `• \`pix 800 aluguel\` — pix\n` +
      `• \`deb 25,90 padaria\` — débito\n` +
      `• \`din 10 estacionamento\` — dinheiro\n` +
      `• \`-50 reembolso\` — valor negativo\n` +
      `• \`150 ifood @maria\` — com dependente\n\n` +
      `Use @nome no final para atribuir a um dependente.`,
      { parse_mode: 'Markdown' }
    )
  })

  // /vincular command
  bot.onText(/\/vincular\s+(\S+)\s+(\S+)/, async (msg, match) => {
    if (!match) return
    const chatId = String(msg.chat.id)
    const username = match[1]
    const password = match[2]

    // Authenticate
    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1)

    if (!user) {
      bot.sendMessage(msg.chat.id, '❌ Usuário não encontrado.')
      return
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      bot.sendMessage(msg.chat.id, '❌ Senha incorreta.')
      return
    }

    // Upsert link
    const [existing] = await db
      .select()
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)

    if (existing) {
      await db.update(telegramLinks).set({ userId: user.id }).where(eq(telegramLinks.chatId, chatId))
    } else {
      await db.insert(telegramLinks).values({ chatId, userId: user.id })
    }

    bot.sendMessage(msg.chat.id, `✅ Vinculado como *${user.username}*! Agora pode lançar transações.`, { parse_mode: 'Markdown' })
  })

  // /desvincular command
  bot.onText(/\/desvincular/, async (msg) => {
    const chatId = String(msg.chat.id)
    await db.delete(telegramLinks).where(eq(telegramLinks.chatId, chatId))
    bot.sendMessage(msg.chat.id, '✅ Vínculo removido.')
  })

  // /status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = String(msg.chat.id)
    const [link] = await db
      .select({ userId: telegramLinks.userId })
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)

    if (!link) {
      bot.sendMessage(msg.chat.id, '❌ Nenhuma conta vinculada. Use /vincular usuario senha')
      return
    }

    const [user] = await db.select({ username: users.username }).from(users).where(eq(users.id, link.userId)).limit(1)
    bot.sendMessage(msg.chat.id, `✅ Vinculado como: *${user?.username ?? 'desconhecido'}*`, { parse_mode: 'Markdown' })
  })

  // Transaction messages (not commands)
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return

    const chatId = String(msg.chat.id)

    // Get linked user
    const [link] = await db
      .select({ userId: telegramLinks.userId })
      .from(telegramLinks)
      .where(eq(telegramLinks.chatId, chatId))
      .limit(1)

    if (!link) {
      bot.sendMessage(msg.chat.id, '❌ Vincule sua conta primeiro: /vincular usuario senha')
      return
    }

    // Parse message
    const parsed = parseMessage(msg.text)
    if (!parsed) {
      bot.sendMessage(msg.chat.id, '❓ Formato inválido.\nExemplo: `150,50 ifood` ou `pix 800 aluguel @maria`', { parse_mode: 'Markdown' })
      return
    }

    // Resolve dependent if specified
    let dependentId: string | null = null
    if (parsed.dependentName) {
      const [dep] = await db
        .select({ id: dependents.id })
        .from(dependents)
        .where(sql`lower(${dependents.name}) = lower(${parsed.dependentName})`)
        .limit(1)

      if (dep) {
        dependentId = dep.id
      } else {
        // Auto-create dependent
        const [created] = await db
          .insert(dependents)
          .values({ name: parsed.dependentName, userId: link.userId })
          .returning()
        dependentId = created.id
      }
    }

    // Insert transaction
    try {
      await db.insert(transactions).values({
        date: getCurrentDate(),
        description: parsed.description,
        amount: parsed.amount,
        categoryId: null,
        dependentId,
        source: 'manual',
        importId: null,
        paymentMethod: parsed.paymentMethod,
        referenceMonth: getCurrentMonth(),
        userId: link.userId,
      })

      const formattedAmount = (parsed.amount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      const typeLabel = parsed.paymentMethod === 'credito' ? '💳' : parsed.paymentMethod === 'pix' ? '📱' : parsed.paymentMethod === 'debito' ? '👛' : '💵'
      const depLabel = parsed.dependentName ? ` → ${parsed.dependentName}` : ''

      bot.sendMessage(msg.chat.id,
        `✅ Lançado!\n${typeLabel} ${formattedAmount} — ${parsed.description}${depLabel}`,
      )
    } catch (err) {
      console.error('Telegram bot error:', err)
      bot.sendMessage(msg.chat.id, '❌ Erro ao salvar transação. Tente novamente.')
    }
  })
}
