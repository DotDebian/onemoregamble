import Anthropic from '@anthropic-ai/sdk'
// `@anthropic-ai/claude-agent-sdk` is imported dynamically (only when the
// subscription path is attempted), so an API-key-only build/container never
// loads it or its bundled native binary.

interface SnapshotItem {
  label: string
  value: string
}
interface IndicatorBlock {
  name: string
  describe?: string
  items: SnapshotItem[]
}
interface SessionBlock {
  name: string
  open: boolean
  eta: string
}
interface MarketContext {
  symbol: string
  interval: string
  time?: string
  price?: number
  candle?: { o: number; h: number; l: number; c: number; v: number }
  stats24h?: { high: number; low: number; changePct: number; quoteVolume: number }
  futures?: { fundingRate: number; openInterestUsd: number; markPrice: number }
  orderBook?: { imbalance: number; spreadPct: number }
  liquidations?: {
    long1h: number
    short1h: number
    whales: number
    whaleUsd: number
    estCluster?: { price: number; side: 'long' | 'short' }
    realCluster?: { price: number; usd: number; side: 'long' | 'short' }
  }
  indicators?: IndicatorBlock[]
  sessions?: SessionBlock[]
}
interface ChatBody {
  messages: { role: 'user' | 'assistant'; content: string }[]
  context?: MarketContext
  /** Optional per-request thinking-effort override (validated server-side). */
  effort?: string
}

const EFFORTS = ['low', 'medium', 'high', 'max'] as const
type Effort = (typeof EFFORTS)[number]

function buildSystemPrompt(ctx?: MarketContext): string {
  const base = `Tu es l'assistant d'analyse de "OneMoreGamble", un terminal de trading temps réel.
Tu aides l'utilisateur à lire le graphique BTC/USDT en bougies de 5 minutes (données Binance).

Règles :
- Réponds en français, de façon précise, concise et structurée (markdown).
- Appuie-toi sur le SNAPSHOT MARCHÉ ci-dessous, qui reflète l'instant T (la dernière bougie peut être encore en formation).
- Tu peux analyser la technique (tendance, momentum, volatilité, zones, sessions) et expliquer ce que disent les indicateurs.
- Ne donne jamais de garantie de gain ni de conseil financier personnalisé ; parle en termes de scénarios, de probabilités et de gestion du risque.
- Si une donnée manque, dis-le plutôt que d'inventer.`

  if (!ctx) return base

  const lines: string[] = ['', '=== SNAPSHOT MARCHÉ ===']
  lines.push(`Instrument : ${ctx.symbol} · ${ctx.interval}`)
  if (ctx.time) lines.push(`Horodatage : ${ctx.time}`)
  if (ctx.price != null) lines.push(`Dernier prix : ${ctx.price}`)
  if (ctx.candle) {
    const k = ctx.candle
    lines.push(`Dernière bougie — O:${k.o} H:${k.h} L:${k.l} C:${k.c} V:${k.v}`)
  }
  if (ctx.stats24h) {
    const s = ctx.stats24h
    lines.push(
      `Stats 24h — Haut:${s.high} Bas:${s.low} Var:${s.changePct.toFixed(2)}% Volume(quote):${Math.round(s.quoteVolume)}`,
    )
  }
  if (ctx.futures) {
    const f = ctx.futures
    lines.push(
      `Futures — Funding:${(f.fundingRate * 100).toFixed(4)}% OpenInterest:${Math.round(f.openInterestUsd)}$ Mark:${f.markPrice}`,
    )
  }
  if (ctx.orderBook) {
    const o = ctx.orderBook
    lines.push(
      `Carnet (top 20) — Déséquilibre bid:${(o.imbalance * 100).toFixed(0)}% / ask:${((1 - o.imbalance) * 100).toFixed(0)}% · spread:${o.spreadPct.toFixed(3)}%`,
    )
  }
  if (ctx.liquidations) {
    const l = ctx.liquidations
    lines.push(
      `Liquidations 1h (réelles) — longs:${Math.round(l.long1h)}$ shorts:${Math.round(l.short1h)}$ · ${l.whales} whale(s) (≥100k) pour ${Math.round(l.whaleUsd)}$`,
    )
    if (l.realCluster) {
      lines.push(
        `  · plus gros cluster RÉEL ~${Math.round(l.realCluster.price)} (${Math.round(l.realCluster.usd)}$, côté ${l.realCluster.side === 'long' ? 'longs' : 'shorts'})`,
      )
    }
    if (l.estCluster) {
      lines.push(
        `  · cluster ESTIMÉ (modèle de levier, prédictif) ~${Math.round(l.estCluster.price)} côté ${l.estCluster.side === 'long' ? 'longs' : 'shorts'}`,
      )
    }
  }
  if (ctx.sessions?.length) {
    lines.push('', 'Sessions de marché :')
    for (const s of ctx.sessions) {
      lines.push(`- ${s.name} : ${s.open ? 'OUVERTE' : 'fermée'} (${s.eta})`)
    }
  }
  if (ctx.indicators?.length) {
    lines.push('', 'Indicateurs (instant T) :')
    for (const ind of ctx.indicators) {
      const head = ind.describe ? `${ind.name} (${ind.describe})` : ind.name
      const vals = ind.items.map((i) => `${i.label}=${i.value}`).join(', ')
      lines.push(`- ${head} : ${vals}`)
    }
  }
  return base + '\n' + lines.join('\n')
}

/** Flatten the chat history into a single prompt string for the Agent SDK. */
function buildPrompt(messages: { role: 'user' | 'assistant'; content: string }[]): string {
  if (messages.length === 1) return messages[0]!.content
  const prior = messages.slice(0, -1)
  const last = messages[messages.length - 1]!
  const transcript = prior
    .map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${m.content}`)
    .join('\n\n')
  return `Conversation précédente :\n${transcript}\n\nNouvelle question de l'utilisateur :\n${last.content}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ChatBody>(event)
  const config = useRuntimeConfig()
  const apiKey = config.anthropicApiKey || process.env.ANTHROPIC_API_KEY

  const messages = (body.messages ?? []).filter((m) => m.content?.trim())
  if (!messages.length) {
    setResponseStatus(event, 400)
    return { error: 'empty', message: 'Aucun message.' }
  }

  const system = buildSystemPrompt(body.context)
  const model = String(config.public.model || 'claude-sonnet-4-6')
  // Per-request override (e.g. high-effort synthesis lessons) wins over the
  // configured default, but only if it's a recognised effort value.
  const effort: Effort =
    body.effort && (EFFORTS as readonly string[]).includes(body.effort)
      ? (body.effort as Effort)
      : (String(config.public.effort || 'medium') as Effort)

  // Auth strategy via CHAT_MODE: 'auto' (subscription, then API-key fallback),
  // 'api' (key only — skips the Claude Code subprocess, ideal for containers),
  // or 'subscription' (subscription only, no key fallback).
  const chatMode = (process.env.CHAT_MODE || 'auto').toLowerCase()

  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', 'no-cache, no-transform')
  setHeader(event, 'X-Accel-Buffering', 'no')

  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (s: string) => controller.enqueue(encoder.encode(s))
      let emitted = false

      // ── 1) Primary: `claude -p` / Agent SDK on the Claude subscription ──
      // Strip ANTHROPIC_API_KEY from the subprocess env so Claude Code
      // authenticates via the subscription (OAuth `claude /login`, or a
      // CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token`) and draws on the
      // plan's Agent SDK credit. Skipped entirely in 'api' mode.
      if (chatMode !== 'api') {
        try {
          const { query } = await import('@anthropic-ai/claude-agent-sdk')
          const subEnv: Record<string, string | undefined> = { ...process.env }
          delete subEnv.ANTHROPIC_API_KEY
          delete subEnv.ANTHROPIC_AUTH_TOKEN
          for await (const message of query({
            prompt: buildPrompt(messages),
            options: {
              model,
              effort,
              systemPrompt: system,
              includePartialMessages: true,
              maxTurns: 1,
              allowedTools: [],
              permissionMode: 'dontAsk',
              settingSources: [],
              env: subEnv,
            },
          })) {
            if (message.type === 'stream_event') {
              const ev = message.event
              if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
                push(ev.delta.text)
                emitted = true
              }
            } else if (message.type === 'result') {
              const r = message as { total_cost_usd?: number; duration_ms?: number }
              console.log(
                '[chat] usage',
                JSON.stringify({ via: 'subscription', model, effort, costUsd: r.total_cost_usd, ms: r.duration_ms }),
              )
            }
          }
        } catch (err) {
          // Subscription unavailable (not logged in, offline, etc.) — fall through.
          console.log('[chat] subscription path KO:', err instanceof Error ? err.message : err)
        }
      }

      // ── 2) Fallback: Messages API with the API key (per-token) ──
      if (!emitted && chatMode !== 'subscription' && apiKey) {
        try {
          const client = new Anthropic({ apiKey })
          const stream = client.messages.stream({
            model,
            max_tokens: 8000,
            thinking: { type: 'adaptive' },
            output_config: { effort },
            system,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          })
          stream.on('text', (delta) => {
            push(delta)
            emitted = true
          })
          const final = await stream.finalMessage()
          const u = final.usage
          console.log(
            '[chat] usage',
            JSON.stringify({ via: 'api', model, effort, input: u.input_tokens, output: u.output_tokens }),
          )
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Erreur inconnue'
          push(`\n\n⚠️ Erreur : ${msg}`)
        }
      }

      // Nothing produced output → explain how to fix authentication.
      if (!emitted) {
        push(
          chatMode === 'subscription'
            ? "⚠️ Abonnement Claude indisponible. Lance `claude /login` ou fournis CLAUDE_CODE_OAUTH_TOKEN."
            : "⚠️ Aucune authentification. Ajoute ANTHROPIC_API_KEY (clé API) ou connecte un abonnement Claude.",
        )
      }

      controller.close()
    },
  })
})
