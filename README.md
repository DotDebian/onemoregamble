# OneMoreGamble

Terminal de trading temps réel — **BTC/USDT en bougies 5 min (Binance)** — avec un
assistant **Claude** conscient du graphique.

- **Chart plein écran (gauche)** à la TradingView : bougies + indicateurs dessinés
  par-dessus, panes empilés (RSI, MACD, Volume), zones de session de marché en fond.
- **Sidebar (droite)** : récapitulatif des indicateurs à l'instant T (dernière bougie)
  en haut, **chat avec Claude** en bas, qui reçoit un snapshot live du marché.

Construit avec **Nuxt 4** + **lightweight-charts v5** (la lib OSS de TradingView) +
**@anthropic-ai/sdk** (modèle `claude-opus-4-8`, streaming, adaptive thinking).

## Boîte à outils

**Navigation** — sélecteur de **paire** (BTC/ETH/SOL/BNB/XRP/DOGE) et de **timeframe**
(1m → 1D), rechargement live.

**Indicateurs**
- Mathématiques : EMA, SMA, Bollinger, VWAP (+ bandes σ), RSI, MACD, ATR, Volume.
- Structure : **pivots journaliers** (PP/R1-3/S1-3), **support/résistance auto** (clustering
  de swings, force par touches), **structure de marché** (HH/HL/LH/LL + tendance).
- Overlays : **Volume Profile** (POC / Value Area sur la zone visible), **sessions de marché**.

**Outils de dessin** (barre à gauche) — ligne horizontale, trendline, ray, rectangle/zone,
**Fibonacci**, **mesure**, **position/Risk-Reward**. Créer · sélectionner · déplacer ·
supprimer (Suppr) · persistés par paire.

**Order flow** — déséquilibre du **carnet d'ordres** (WS depth), **funding rate** + **open
interest** (futures), stats 24h.

**Liquidations** (toggle « Liquidations (heatmap) » dans le sélecteur) — trois couches :
- **Heatmap estimée** (modèle de paliers de levier, par bucket de prix — *pas* la position
  book de l'exchange) : bandes colorées prédictives (les aimants à prix).
- **Liquidations réelles persistées** : un plugin serveur Nitro écoute en continu le stream
  `!forceOrder@arr` (Binance Futures) et accumule l'historique en mémoire ; le client le lit
  via `/api/liquidations` (historique) + **SSE** (`/api/liquidations/stream`, temps réel).
  Rendu en **bulles** (taille = $, rouge = longs liquidés, vert = shorts) + une bande
  « réelle » par prix à droite.
- **Whales** (≥ 100k$) : bulles à halo doré, filtre « whales only » et stats dédiées.

> Les liquidations sont un produit **Futures** : elles nécessitent que le réseau du serveur
> atteigne `fstream.binance.com`. La heatmap estimée et tout le reste fonctionnent même si
> ce flux est indisponible. Le tag « live / hors-ligne » dans le panneau Order flow indique
> l'état de la connexion serveur.

**Alertes** — prix / RSI / croisement EMA, notifications navigateur, lignes sur le graphe.

**Risque** — calculateur de position (capital, risque %, entrée/stop/cible → taille, R:R),
synchronisable avec l'outil position du graphe.

**Copilote Claude** — reçoit tout le contexte (indicateurs, niveaux, sessions, funding/OI,
déséquilibre carnet, stats 24h) à l'instant T.

**Aide pédagogique** — un **« ? »** sur chaque indicateur/overlay actif : **survol** = tooltip
court (« ce qui apparaît sur le graphe »), **clic** = modal détaillée (c'est quoi, comment le
lire, signaux clés, conseil débutant).

**Formation guidée (live)** — un onglet **Formation** : 8 leçons progressives (lire une bougie →
tendance/structure → niveaux → RSI → MACD/volume → VWAP/Bollinger → **stratégie confluence
EMA+RSI** → gestion du risque), inspirées de la pédagogie Babypips. Chaque leçon **active les
bons indicateurs** d'un clic et déclenche une **analyse du marché en direct** par Claude
(« Analyser le graphe maintenant ») — on se forme sur la situation réelle, pas en théorie.

## Démarrage

```bash
pnpm install
cp .env.example .env      # puis renseigne ANTHROPIC_API_KEY pour activer le chat
pnpm dev                  # http://localhost:3000
```

Les données de marché (Binance REST + WebSocket public) ne nécessitent **aucune clé**.
Le graphique et les indicateurs fonctionnent immédiatement ; seul le chat requiert une
clé API Anthropic.

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `ANTHROPIC_API_KEY` | Clé API Anthropic (chat). `NUXT_ANTHROPIC_API_KEY` fonctionne aussi. |

## Scripts

```bash
pnpm dev         # serveur de dev
pnpm build       # build production (Nitro)
pnpm preview     # prévisualise le build
pnpm test        # tests unitaires du moteur d'indicateurs (vitest)
pnpm typecheck   # vérification de types (vue-tsc)
```

## Architecture

```
app/
  app.vue                     Layout : top bar + chart + sidebar
  assets/css/main.css         Thème "terminal" (IBM Plex, accent or)
  components/
    TradingChart.vue          lightweight-charts : bougies, overlays, panes, live
    chart/sessionsPrimitive.ts Primitive canvas : zones de session en fond
    IndicatorPanel.vue        Récap instant T + sessions + sélecteur d'indicateurs
    ChatPanel.vue             Chat streaming avec Claude
  composables/
    useMarket.ts              Données Binance (REST historique + WS live, singleton)
    useIndicators.ts          Calcul réactif des indicateurs (partagé chart/récap)
    useIndicatorState.ts      Indicateurs activés (persisté localStorage)
    useChat.ts                Construit le contexte marché + streaming du chat
  indicators/
    math.ts                   Primitives pures (SMA, EMA, RSI, MACD, ATR, σ)
    types.ts                  Contrat d'un indicateur
    sessions.ts               Sessions de marché (non-mathématique)
    definitions/*.ts          1 fichier = 1 indicateur
    index.ts                  Registre
server/api/
  chat.post.ts                Route Claude (streaming + contexte injecté)
  chat-status.get.ts          Indique si une clé est configurée
test/indicators.test.ts       Tests du moteur
```

## Ajouter un indicateur

1. Crée `app/indicators/definitions/mon-indicateur.ts` exportant un `IndicatorDefinition`
   (`compute()` renvoie des `plots`; `pane: 'price'` pour un overlay, `'separate'` pour
   un pane dédié; `snapshot()` optionnel pour le récap).
2. Ajoute-le au tableau `INDICATORS` dans `app/indicators/index.ts`.

C'est tout : il apparaît dans le sélecteur, sur le graphique, dans le récap et dans le
contexte envoyé à Claude.

## Notes

- App rendue en **SPA** (`ssr: false`) — adapté au temps réel et au canvas. Le serveur
  Nitro reste actif pour `/api/chat`.
- Le WebSocket Binance se reconnecte automatiquement (backoff) et rafraîchit
  l'historique pour combler les trous.
- Indicateurs inclus : EMA (9/21/50), SMA (200), Bollinger (20, 2σ), VWAP, RSI (14),
  MACD (12/26/9), ATR (14), Volume + MA, et les sessions Asie / Londres / New York.
