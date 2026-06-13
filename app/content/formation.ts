// Interactive curriculum, organised into self-contained MODULES (tracks).
//
// - "Parcours essentiel" follows the classic Babypips path (price → structure →
//   levels → momentum → volatility → confluence → risk) and culminates in a
//   concrete, widely-taught strategy: EMA + RSI confluence.
// - Additional tracks cover the rest of the standard beginner→intermediate canon
//   (per-indicator mastery, candlestick patterns, chart patterns, Fibonacci,
//   Smart Money Concepts, trading psychology).
//
// Each lesson can switch on the relevant indicators/overlays and fire a live,
// market-relative question to the Claude copilot. `enable` ids must match the
// indicator/overlay registry (see app/indicators/index.ts):
//   ema sma bollinger vwap vwapBands pivots autosr structure rsi macd atr
//   volume · sessions volumeProfile liquidations

export interface Lesson {
  id: string
  title: string
  goal: string
  /** Markdown teaching body. */
  body: string
  /** Indicator / overlay ids to enable for this lesson. */
  enable: string[]
  /** What to look at on the live chart right now. */
  watch: string
  /** Question sent to the Claude copilot for a live, market-relative analysis. */
  prompt: string
  /** Thinking-effort override for this lesson's live analysis (default: medium).
   *  Set 'high' on multi-signal synthesis lessons where deeper reasoning pays off. */
  effort?: 'low' | 'medium' | 'high' | 'max'
}

export interface Module {
  id: string
  title: string
  /** One-line pitch shown on the module card. */
  tagline: string
  icon: string
  level: 'Débutant' | 'Intermédiaire' | 'Avancé' | 'Transversal'
  lessons: Lesson[]
}

// ───────────────────────────── Parcours essentiel ─────────────────────────────

const ESSENTIEL: Lesson[] = [
  {
    id: 'bougie',
    title: '1 · Lire une bougie',
    goal: 'Comprendre ce que raconte une bougie japonaise.',
    body: `Chaque bougie de 5 min résume **4 prix** : ouverture (O), plus-haut (H), plus-bas (L), clôture (C).

- **Corps** = entre l'ouverture et la clôture. Vert = clôture au-dessus de l'ouverture (acheteurs), rouge = l'inverse.
- **Mèches** = les extrêmes atteints puis rejetés. Une longue mèche basse = les vendeurs ont poussé mais les acheteurs ont repris la main.

**Le b.a.-ba :** un grand corps vert = pression acheteuse forte ; une bougie à longues mèches et petit corps = indécision.`,
    enable: [],
    watch: "Survole les bougies : la légende en haut à gauche affiche O/H/L/C. Repère une bougie à longue mèche.",
    prompt:
      "Je débute totalement. Décris-moi simplement la dernière bougie BTC/USDT 5m (corps, mèches) et ce qu'elle dit du rapport de force acheteurs/vendeurs là maintenant. Reste très pédagogique.",
  },
  {
    id: 'structure',
    title: '2 · Tendance & structure',
    goal: 'Identifier une tendance avec la structure et les EMA.',
    body: `Une tendance, c'est une **succession de sommets et creux** :

- **Haussière** : sommets plus hauts (HH) + creux plus hauts (HL).
- **Baissière** : sommets plus bas (LH) + creux plus bas (LL).

Les **EMA** (9/21/50) confirment d'un coup d'œil : empilées 9>21>50 et montantes = tendance haussière. On évite de trader **contre** la tendance.`,
    enable: ['structure', 'ema'],
    watch: "J'ai activé la Structure (HH/HL) et les EMA. Regarde l'empilement des EMA et les étiquettes sur les sommets/creux.",
    prompt:
      "Avec la structure de marché (HH/HL) et l'empilement des EMA 9/21/50 actuels, dis-moi simplement : BTC/USDT 5m est-il en tendance haussière, baissière ou en range en ce moment ? Sur quoi te bases-tu ?",
  },
  {
    id: 'niveaux',
    title: '3 · Supports, résistances & pivots',
    goal: 'Repérer les niveaux où le prix réagit.',
    body: `Le prix ne bouge pas au hasard : il **réagit à des niveaux**.

- **Support** : un plancher où les acheteurs reviennent.
- **Résistance** : un plafond où les vendeurs reprennent.
- **Pivots journaliers** (PP, R1–R3, S1–S3) : des niveaux de référence calculés sur la veille.

Plus un niveau a été **touché**, plus il est solide. On guette les **rebonds** et les **cassures + retests**.`,
    enable: ['autosr', 'pivots'],
    watch: "J'ai activé les Supports/Résistances auto et les Pivots. Regarde les lignes horizontales et leur force (·2, ·3…).",
    prompt:
      "Avec les supports/résistances et les pivots affichés, quels sont les niveaux clés au-dessus et en dessous du prix actuel de BTC/USDT ? Lequel surveiller en priorité et pourquoi ?",
  },
  {
    id: 'rsi',
    title: '4 · Momentum : le RSI',
    goal: 'Mesurer la force du mouvement et repérer les excès.',
    body: `Le **RSI** (0 à 100) mesure le momentum :

- **> 70** : surachat (hausse mûre) · **< 30** : survente.
- La **ligne 50** sépare biais haussier et baissier ; la stratégie qu'on vise utilise **55** et **45**.

⚠️ En forte tendance, le RSI peut rester en zone extrême longtemps — ce n'est **pas** un ordre de vendre/acheter à lui seul.`,
    enable: ['rsi'],
    watch: "J'ai activé le RSI (pane du bas). Regarde sa valeur et de quel côté de 50 il se situe.",
    prompt:
      "En te basant sur la valeur RSI(14) actuelle de BTC/USDT 5m, est-il en surachat, survente ou neutre ? Qu'est-ce que ça suggère maintenant, et qu'est-ce que je dois surveiller ? Explique simplement.",
  },
  {
    id: 'confirmation',
    title: '5 · Confirmer : MACD & volume',
    goal: 'Vérifier le momentum et la conviction derrière un mouvement.',
    body: `Avant d'agir, on **confirme** :

- **MACD** : croisement de la ligne au-dessus du signal + histogramme positif = momentum haussier.
- **Volume** : un mouvement avec un volume supérieur à la moyenne est plus crédible. Une cassure **sans** volume est suspecte.

L'idée : ne pas se fier à un seul signal mais à un **faisceau de confirmations**.`,
    enable: ['macd', 'volume'],
    watch: "J'ai activé le MACD et le Volume. Regarde le sens de l'histogramme MACD et si le volume dépasse sa moyenne.",
    prompt:
      "Avec le MACD et le volume actuels de BTC/USDT 5m : le momentum confirme-t-il la tendance en cours ? Le volume soutient-il le dernier mouvement ? Réponds simplement, comme à un débutant.",
  },
  {
    id: 'volatilite',
    title: '6 · Volatilité & juste prix',
    goal: 'Situer le prix par rapport à sa moyenne et à la volatilité.',
    body: `- **VWAP** : le « prix juste » de la journée pondéré par le volume. Au-dessus = acheteurs en contrôle. Le prix y revient souvent (aimant).
- **Bollinger** : un canal de volatilité. Bandes **serrées** = calme avant un mouvement (squeeze) ; bandes larges = agitation.

Ça te dit si le prix est **étiré** (loin de sa moyenne) ou au contraire **comprimé**.`,
    enable: ['vwap', 'bollinger'],
    watch: "J'ai activé le VWAP et les Bollinger. Regarde où est le prix vs le VWAP, et si les bandes sont serrées ou larges.",
    prompt:
      "Avec le VWAP et les bandes de Bollinger actuels : le prix de BTC/USDT 5m est-il au-dessus ou en dessous de sa valeur moyenne, et est-il étiré ou comprimé ? Qu'est-ce que ça implique ?",
  },
  {
    id: 'strategie',
    effort: 'high',
    title: '7 · La stratégie : confluence EMA + RSI',
    goal: 'Assembler une vraie stratégie complète et cohérente.',
    body: `Voici une stratégie débutant éprouvée, fondée sur la **confluence** (plusieurs feux verts alignés) :

**Le plan (achat) :**
1. **Tendance** : EMA empilées 9>21>50 et montantes (et idéalement prix > SMA 200).
2. **Niveau** : le prix rebondit sur un support / l'EMA 21 / le VWAP.
3. **Timing** : RSI qui repasse **au-dessus de 55**.
4. **Confirmation** : histogramme MACD qui repasse positif, volume présent.
5. **Invalidation** : un stop sous le dernier creux.

Pour une **vente**, on inverse (EMA 9<21<50, RSI < 45, etc.).

> La règle d'or : **n'entre que si plusieurs conditions sont réunies en même temps**. Un seul indicateur = trop de faux signaux.`,
    enable: ['ema', 'rsi', 'macd', 'autosr', 'volume'],
    watch: "J'ai activé l'ensemble de la stratégie (EMA, RSI, MACD, S/R, Volume). Vérifie combien de conditions sont réunies maintenant.",
    prompt:
      "Applique la stratégie de confluence EMA+RSI à BTC/USDT 5m maintenant : passe en revue tendance (EMA), niveau (S/R), RSI (55/45), MACD et volume. Combien de conditions sont réunies pour un achat ou une vente ? Conclus par : signal d'achat, de vente, ou attendre — et pourquoi. Pédagogique, sans garantie.",
  },
  {
    id: 'risque',
    title: '8 · Gestion du risque',
    goal: 'Protéger ton capital — la compétence n°1.',
    body: `Même un bon trader perd souvent. Ce qui compte, c'est de **perdre petit et gagner gros**.

- **Risque fixe** : ne risque qu'un faible % de ton capital par trade (souvent **1%**).
- **Stop loss** : défini *avant* d'entrer, sous le dernier creux (ou via l'ATR : entrée − 1,5×ATR).
- **Ratio risque/récompense (R:R)** : vise au moins **1:2** (gagner 2× ce que tu risques).
- **Taille de position** : calculée pour que ton stop = ton risque max.

👉 Utilise l'onglet **Risque** : il calcule ta taille de position, et tu peux dessiner ton entrée/stop/cible avec l'outil **Position** sur le graphe.`,
    enable: ['atr'],
    watch: "J'ai activé l'ATR (volatilité, pour dimensionner le stop). Ouvre l'onglet Risque et l'outil Position (barre à gauche du graphe).",
    prompt:
      "Je veux placer un trade sur BTC/USDT au prix actuel avec 1% de risque. En te basant sur l'ATR actuel, propose-moi un exemple pédagogique : où mettre un stop raisonnable, une cible à R:R 1:2, et rappelle-moi pourquoi la gestion du risque prime. Sans conseil financier personnalisé.",
  },
]

// ──────────────────────── Maîtrise par indicateur ────────────────────────

const INDICATEURS: Lesson[] = [
  {
    id: 'i-ema',
    title: '1 · EMA 9 / 21 / 50',
    goal: "Lire la tendance et les rebonds via l'empilement des moyennes.",
    body: `L'**EMA** lisse le prix en pondérant les bougies récentes. On en suit trois :

- **Empilement** 9>21>50 montantes = tendance haussière (et l'inverse).
- **Croisement** 9 au-dessus de 21 = bascule de momentum.
- Les EMA 21/50 servent de **support/résistance dynamiques** : le prix vient les retoucher puis repart.`,
    enable: ['ema'],
    watch: "Seules les EMA sont activées. Note l'ordre (9>21>50 ?), la pente, et l'écart entre les courbes.",
    prompt:
      "Regarde uniquement les EMA 9/21/50 de BTC/USDT 5m maintenant : comment sont-elles empilées et orientées ? Le prix vient-il de retoucher l'une d'elles ? Que conclus-tu sur la tendance ? Pédagogique.",
  },
  {
    id: 'i-sma',
    title: '2 · SMA 200',
    goal: 'Filtrer le contexte de fond le plus suivi au monde.',
    body: `La **SMA 200** est la référence de tendance long terme.

- Prix **au-dessus** = contexte globalement haussier → on privilégie les achats.
- Prix **en dessous** = contexte baissier → prudence / ventes.
- Sa **pente** donne la direction de fond ; elle agit souvent comme gros support/résistance.

C'est un **filtre de contexte**, pas un signal d'entrée à elle seule.`,
    enable: ['sma'],
    watch: "La SMA 200 est activée. Le prix est-il au-dessus ou en dessous ? Quelle est sa pente ?",
    prompt:
      "Par rapport à la SMA 200 actuelle de BTC/USDT 5m : le prix est-il au-dessus ou en dessous, et la pente est-elle montante/plate/descendante ? Quel biais de fond ça donne ? Simple et clair.",
  },
  {
    id: 'i-rsi',
    title: '3 · RSI — au-delà du surachat',
    goal: 'Utiliser les zones 55/45 et repérer les divergences.',
    body: `Le **RSI(14)** n'est pas qu'un détecteur de surachat/survente.

- **Filtre de tendance** : > 55 = biais haussier, < 45 = baissier.
- **Divergence régulière** : prix fait un plus-haut, RSI un plus-bas → essoufflement possible.
- **Divergence cachée** : signal de **continuation** dans le sens de la tendance.

> En forte tendance, rester > 70 ou < 30 est **normal** : ce n'est pas un ordre d'agir.`,
    enable: ['rsi'],
    watch: "Le RSI est activé (pane du bas). Situe-le vs 50/55/45 et compare ses sommets/creux à ceux du prix.",
    prompt:
      "Analyse le RSI(14) de BTC/USDT 5m : de quel côté de 55/45 est-il ? Vois-tu une divergence (régulière ou cachée) avec le prix récent ? Qu'est-ce que ça suggère ? Reste pédagogique.",
  },
  {
    id: 'i-macd',
    title: '4 · MACD — croisements & ligne zéro',
    goal: "Lire le momentum via l'histogramme et la ligne zéro.",
    body: `Le **MACD (12,26,9)** combine tendance et momentum.

- **Croisement** MACD au-dessus du signal = impulsion haussière (et l'inverse).
- **Ligne zéro** : au-dessus = momentum globalement haussier ; le franchir = renforcement.
- **Histogramme** qui se contracte = le mouvement s'essouffle avant même le croisement.

Indicateur **retardé** : il confirme, il n'anticipe pas.`,
    enable: ['macd'],
    watch: "Le MACD est activé. Regarde le croisement des lignes, le côté de la ligne zéro et l'allure de l'histogramme.",
    prompt:
      "Sur le MACD actuel de BTC/USDT 5m : la ligne est-elle au-dessus/en dessous de son signal et de zéro ? L'histogramme grandit-il ou se contracte-t-il ? Le momentum confirme-t-il la tendance ? Explique simplement.",
  },
  {
    id: 'i-bollinger',
    title: '5 · Bollinger — squeeze & marche sur bande',
    goal: 'Lire la volatilité : compression vs expansion.',
    body: `Les **Bandes de Bollinger** (20, 2σ) mesurent la volatilité.

- **Squeeze** : bandes très serrées = calme → un mouvement se prépare.
- **Marche sur la bande** : en tendance forte, le prix « longe » la bande haute/basse — ce n'est **pas** un signal de retournement.
- **%B** situe le prix dans le canal (1 = bande haute, 0 = bande basse).`,
    enable: ['bollinger'],
    watch: "Les Bollinger sont activées. Les bandes sont-elles serrées (squeeze) ou larges ? Le prix longe-t-il une bande ?",
    prompt:
      "Regarde les bandes de Bollinger de BTC/USDT 5m : sont-elles en squeeze ou élargies ? Le prix touche/longe-t-il une bande ? Cela ressemble-t-il à une compression avant mouvement ou à une tendance qui marche sur la bande ? Pédagogique.",
  },
  {
    id: 'i-vwap',
    title: '6 · VWAP & bandes de déviation',
    goal: "Trouver le « prix juste » du jour et ses extrêmes.",
    body: `Le **VWAP** est le prix moyen pondéré par le volume depuis l'ouverture (la référence des institutionnels).

- Prix **au-dessus** = acheteurs en contrôle sur la séance.
- Le prix **revient** souvent vers le VWAP (aimant de moyenne).
- Les **bandes ±1σ / ±2σ** marquent les zones étirées : à ±2σ, un retour vers la moyenne est plus probable.`,
    enable: ['vwap', 'vwapBands'],
    watch: "VWAP + bandes activés. Où est le prix vs le VWAP, et vers quelle bande (±1σ / ±2σ) penche-t-il ?",
    prompt:
      "Avec le VWAP et ses bandes ±1σ/±2σ sur BTC/USDT 5m : le prix est-il au-dessus ou en dessous du VWAP, et proche d'une bande extrême ? Est-il étiré (retour probable) ou centré ? Explique simplement.",
  },
  {
    id: 'i-atr',
    title: '7 · ATR — la respiration du marché',
    goal: 'Mesurer la volatilité pour dimensionner stop et position.',
    body: `L'**ATR(14)** mesure l'amplitude moyenne des bougies, en dollars.

- ATR **élevé** = grandes bougies, marché agité → stops plus larges.
- ATR **faible** = calme → stops plus serrés.
- Usage clé : **stop = entrée − 1,5 × ATR**, puis taille de position pour ne risquer que 1%.

L'ATR ne donne **aucune direction** : c'est un outil de **risque**.`,
    enable: ['atr'],
    watch: "L'ATR est activé. Note sa valeur actuelle (en $ et en % du prix) et si elle monte ou descend.",
    prompt:
      "D'après l'ATR actuel de BTC/USDT 5m, la volatilité est-elle haute ou basse en ce moment ? Donne-moi un exemple d'écart de stop raisonnable (≈1,5×ATR) à partir du prix actuel, et rappelle que l'ATR ne donne pas de direction.",
  },
  {
    id: 'i-volume',
    title: '8 · Volume — la conviction',
    goal: 'Jauger la force réelle derrière un mouvement.',
    body: `Le **volume** est la quantité échangée par bougie (vert = haussière, rouge = baissière).

- Mouvement avec volume **au-dessus de la moyenne** = conviction.
- **Cassure sans volume** = suspecte (souvent un faux signal).
- **Pic de volume** sur un retournement = capitulation / épuisement possible.

Le volume **confirme** ; il ne prédit pas le sens seul.`,
    enable: ['volume'],
    watch: "Le Volume est activé (pane du bas). La dernière bougie dépasse-t-elle la moyenne de volume (la ligne) ?",
    prompt:
      "Regarde le volume de BTC/USDT 5m : les dernières bougies sont-elles au-dessus ou en dessous de la moyenne ? Le dernier mouvement est-il soutenu par le volume ou suspect ? Pédagogique.",
  },
  {
    id: 'i-pivots',
    title: '9 · Points pivots',
    goal: 'Utiliser les niveaux de séance calculés sur la veille.',
    body: `Les **pivots journaliers** donnent 7 niveaux de référence : **PP** (central) et **R1–R3 / S1–S3**.

- Prix **au-dessus du PP** = biais haussier de la séance ; en dessous = baissier.
- R1/S1 sont les premières cibles/réactions ; R2/R3 et S2/S3, les extrêmes.
- Très utilisés en **intraday** comme objectifs et zones de rebond.`,
    enable: ['pivots'],
    watch: "Les Pivots sont activés. Le prix est-il au-dessus ou en dessous du PP ? Quel R/S est le plus proche ?",
    prompt:
      "Avec les points pivots du jour sur BTC/USDT 5m : le prix est-il au-dessus ou en dessous du PP, et quel niveau (R1/S1…) est la prochaine cible au-dessus et en dessous ? Lequel surveiller ? Simple et concret.",
  },
  {
    id: 'i-autosr',
    title: '10 · Supports / Résistances auto',
    goal: 'Lire des zones classées par nombre de touches.',
    body: `L'outil repère les **swings** marquants et les regroupe en zones, classées par **force** (nombre de touches).

- Plus une ligne a été touchée (·2, ·3, ·4), plus elle est **fiable**.
- **Rouge** = au-dessus du prix (résistance), **vert** = en dessous (support).
- On guette le **rebond** sur la zone ou la **cassure + retest** réussie.

Traite-les comme des **zones**, pas des prix exacts au centime.`,
    enable: ['autosr'],
    watch: "Les S/R auto sont activés. Repère la zone la plus forte (·3, ·4) au-dessus et en dessous du prix.",
    prompt:
      "Avec les supports/résistances automatiques de BTC/USDT 5m : quelles sont les zones les plus solides (par nombre de touches) juste au-dessus et en dessous du prix ? Le prix s'en approche-t-il (rebond ou cassure possible) ? Pédagogique.",
  },
  {
    id: 'i-structure',
    title: '11 · Structure de marché (HH/HL)',
    goal: 'Lire la tendance à la source : les swings.',
    body: `La **structure** étiquette chaque sommet/creux :

- **HH + HL** (higher high / higher low) = tendance **haussière** saine.
- **LH + LL** = tendance **baissière**.
- Le premier **LL** dans une hausse (ou HH dans une baisse) = **cassure de structure (BOS)** → retournement potentiel.

C'est la base à lire **avant** tout indicateur.`,
    enable: ['structure'],
    watch: "La Structure est activée. Lis la séquence d'étiquettes (HH/HL/LH/LL) : que raconte-t-elle ?",
    prompt:
      "D'après la structure de marché (HH/HL/LH/LL) actuelle de BTC/USDT 5m : la séquence est-elle haussière, baissière, ou y a-t-il une cassure de structure récente ? Qu'est-ce que ça implique pour la tendance ? Explique simplement.",
  },
  {
    id: 'i-vprofile',
    title: '12 · Volume Profile (POC & Value Area)',
    goal: 'Voir le volume par prix, pas par temps.',
    body: `Le **Volume Profile** montre le volume échangé **par niveau de prix** sur la zone visible.

- Le **POC** (ligne dorée) = le prix le plus échangé → aimant et S/R majeur.
- La **Value Area** (zone bleue, ~70% du volume) = le « juste prix » d'équilibre.
- Les **zones fines** (peu de volume) sont traversées vite par le prix.`,
    enable: ['volumeProfile'],
    watch: "Le Volume Profile est activé (à droite). Repère le POC (ligne dorée) et la Value Area (zone épaisse).",
    prompt:
      "Avec le Volume Profile de BTC/USDT 5m : où se situe le POC par rapport au prix actuel, et le prix est-il dans la Value Area ou en dehors ? Le POC agit-il comme aimant/support/résistance ici ? Pédagogique.",
  },
  {
    id: 'i-liquidations',
    title: '13 · Liquidations (heatmap)',
    goal: 'Repérer les aimants à prix créés par le levier.',
    body: `Deux choses sur le graphe :

- Une **heatmap estimée** (modèle de paliers de levier) : les bandes chaudes = gros **clusters de liquidations potentielles**, qui agissent comme des **aimants**.
- Les **liquidations réelles** en bulles : rouge = longs liquidés (vente forcée), vert = shorts ; halo doré = « whale » (≥ 100 000 $).

> La heatmap est une **estimation**, pas la donnée de l'exchange : un repère, pas une vérité.`,
    enable: ['liquidations'],
    watch: "Les Liquidations sont activées. Repère la bande chaude la plus proche et les éventuelles bulles récentes.",
    prompt:
      "Avec la heatmap de liquidations de BTC/USDT 5m : y a-t-il un gros cluster estimé proche du prix (aimant possible) ? Vois-tu une cascade de liquidations récentes (longs ou shorts) ? Que peut-on en déduire prudemment ? Rappelle que c'est une estimation.",
  },
]

// ──────────────────────── Chandeliers japonais ────────────────────────

const CHANDELIERS: Lesson[] = [
  {
    id: 'c-doji',
    title: "1 · Doji & toupies — l'indécision",
    goal: 'Reconnaître les bougies de pause et de doute.',
    body: `Quand le **corps est minuscule**, acheteurs et vendeurs s'équilibrent :

- **Doji** : ouverture ≈ clôture, mèches des deux côtés → indécision pure.
- **Toupie** (spinning top) : petit corps, mèches longues → hésitation.

Seul, un doji ne dit rien. **Après une forte tendance**, il signale un essoufflement et une possible pause/retournement.`,
    enable: ['structure', 'volume'],
    watch: "Cherche une bougie à très petit corps (doji/toupie), surtout après une série de bougies dans le même sens.",
    prompt:
      "Sur BTC/USDT 5m, y a-t-il récemment une bougie de type doji ou toupie (indécision) ? Où apparaît-elle par rapport à la tendance et au volume, et qu'est-ce que ça pourrait annoncer ? Explique comme à un débutant.",
  },
  {
    id: 'c-marteau',
    title: '2 · Marteau, pendu & étoile filante',
    goal: 'Lire le rejet d\'un niveau via une longue mèche.',
    body: `Une **longue mèche** = un côté a poussé fort puis s'est fait rejeter.

- **Marteau** : longue mèche **basse** en bas d'une baisse → les acheteurs reprennent (signal haussier).
- **Pendu** (hanging man) : même forme en haut d'une hausse → avertissement baissier.
- **Étoile filante** : longue mèche **haute** en haut d'une hausse → rejet vendeur.

La mèche doit faire **≈ 2×** le corps. Le **contexte** (où elle apparaît) fait tout.`,
    enable: ['structure', 'autosr', 'volume'],
    watch: "Repère une bougie à petit corps et une longue mèche, posée sur un support (marteau) ou une résistance (étoile filante).",
    prompt:
      "Sur BTC/USDT 5m, repères-tu un marteau, un pendu ou une étoile filante récent ? À quel niveau (support/résistance) apparaît-il et le volume le soutient-il ? Quel rejet ça traduit ? Pédagogique, sans garantie.",
  },
  {
    id: 'c-avalement',
    title: '3 · Avalement (engulfing)',
    goal: 'Repérer une prise de contrôle franche.',
    body: `Un **avalement** : une bougie dont le corps **engloutit entièrement** celui de la précédente.

- **Haussier** : une grande bougie verte avale une rouge, en bas d'une baisse → bascule acheteuse.
- **Baissier** : une grande rouge avale une verte, en haut d'une hausse → bascule vendeuse.

C'est l'un des signaux de retournement les plus **lisibles** — surtout sur un niveau clé et avec du volume.`,
    enable: ['structure', 'autosr', 'volume'],
    watch: "Cherche deux bougies où la seconde, de couleur opposée, recouvre complètement le corps de la première.",
    prompt:
      "Sur BTC/USDT 5m, vois-tu une figure d'avalement (engulfing) haussier ou baissier récente ? Se forme-t-elle sur un niveau important, avec du volume ? Quelle bascule de rapport de force ça traduit ? Explique simplement.",
  },
  {
    id: 'c-percee',
    title: '4 · Perçage, nuage noir & pinces',
    goal: 'Compléter ta boîte à figures à deux bougies.',
    body: `D'autres signaux à deux bougies, plus subtils que l'avalement :

- **Ligne de perçage** (haussier) : une rouge, puis une verte qui clôture **au-delà de la moitié** du corps rouge.
- **Couverture en nuage noir** (baissier) : le miroir, en haut d'une hausse.
- **Pinces** (tweezers) : deux bougies avec **le même extrême** (bas = pince basse haussière, haut = pince haute baissière) → niveau défendu.`,
    enable: ['autosr', 'volume'],
    watch: "Cherche une bougie qui reprend la moitié de la précédente (perçage/nuage noir), ou deux mèches qui butent sur le même prix (pinces).",
    prompt:
      "Sur BTC/USDT 5m, repères-tu une ligne de perçage, une couverture en nuage noir ou des pinces (tweezers) récentes ? Sur quel niveau, et qu'est-ce que ça suggère ? Reste pédagogique.",
  },
  {
    id: 'c-etoiles',
    title: '5 · Étoiles du matin / du soir & séries',
    goal: 'Lire les retournements à trois bougies.',
    body: `Les figures à **trois bougies** sont des retournements plus fiables :

- **Étoile du matin** (haussier) : grande rouge → petit corps (pause) → grande verte. Un creux qui se retourne.
- **Étoile du soir** (baissier) : le miroir, en haut d'une hausse.
- **Trois soldats blancs** / **trois corbeaux noirs** : trois bougies pleines successives = poussée directionnelle forte.`,
    enable: ['structure', 'volume'],
    watch: "Cherche un trio : grande bougie, petite bougie de pause, puis grande bougie de sens opposé (étoile).",
    prompt:
      "Sur BTC/USDT 5m, vois-tu une étoile du matin/du soir ou une série de trois soldats/corbeaux récente ? Où, et le volume accompagne-t-il ? Quel retournement ou poussée ça traduit ? Explique simplement.",
  },
  {
    id: 'c-contexte',
    title: '6 · Le contexte fait le signal',
    goal: 'Filtrer les figures pour éviter les pièges.',
    body: `Une figure en chandelier **isolée ne vaut rien**. Ce qui la rend exploitable :

- **L'emplacement** : sur un support/résistance, un pivot, le VWAP ou un POC.
- **La tendance** : un signal haussier a plus de poids en début de creux qu'au milieu d'une chute.
- **Le volume** : une figure de retournement avec gros volume est bien plus crédible.

> Règle : *figure + niveau + volume = trio gagnant.* Sinon, on passe.`,
    enable: ['autosr', 'volume', 'vwap'],
    watch: "Combine : repère une figure récente ET vérifie si elle tombe sur un niveau (S/R, VWAP) avec du volume.",
    prompt:
      "Sur BTC/USDT 5m maintenant : la dernière figure en chandelier notable tombe-t-elle sur un niveau important (S/R, VWAP) et avec du volume ? Est-ce un signal de qualité ou à ignorer selon le trio figure+niveau+volume ? Pédagogique.",
  },
]

// ──────────────────────── Figures chartistes ────────────────────────

const FIGURES: Lesson[] = [
  {
    id: 'f-tete-epaules',
    title: '1 · Tête-épaules (& inversée)',
    goal: 'Repérer la figure de retournement la plus connue.',
    body: `La **tête-épaules** marque un retournement de tendance :

- Trois sommets : une **épaule**, une **tête** (plus haute), une **épaule**.
- La **ligne de cou** (neckline) relie les deux creux.
- **Cassure de la neckline** = signal ; l'objectif ≈ hauteur de la tête reportée sous la cassure.

La version **inversée** (creux) signale un retournement **haussier**.`,
    enable: ['autosr', 'structure', 'volume'],
    watch: "Cherche trois sommets (ou creux) dont celui du milieu dépasse, reliés par une ligne de cou.",
    prompt:
      "Sur BTC/USDT 5m, vois-tu une structure qui ressemble à une tête-épaules (ou inversée) en formation ? Où serait la ligne de cou et qu'est-ce qui validerait/invaliderait la figure ? Reste prudent et pédagogique.",
  },
  {
    id: 'f-double',
    title: '2 · Double sommet / double creux',
    goal: 'Lire un niveau testé deux fois sans le casser.',
    body: `Le prix bute **deux fois** sur le même niveau :

- **Double sommet** (M) : deux sommets proches → résistance qui tient → retournement baissier.
- **Double creux** (W) : deux creux proches → support qui tient → retournement haussier.
- **Validation** : la cassure du creux/sommet intermédiaire. Objectif = hauteur de la figure reportée.

Plus le niveau a tenu nettement, plus la cassure compte.`,
    enable: ['autosr', 'structure', 'volume'],
    watch: "Repère deux sommets (M) ou deux creux (W) au même niveau, et le point intermédiaire à casser.",
    prompt:
      "Sur BTC/USDT 5m, repères-tu un double sommet (M) ou un double creux (W) récent ou en formation ? À quel niveau, et qu'est-ce qui le validerait ? Que surveiller maintenant ? Pédagogique, sans garantie.",
  },
  {
    id: 'f-triangles',
    title: '3 · Triangles',
    goal: 'Lire une compression avant cassure.',
    body: `Un **triangle** = des bougies de plus en plus resserrées (compression) :

- **Ascendant** : sommets plats + creux montants → pression acheteuse → souvent cassure **haut**.
- **Descendant** : creux plats + sommets descendants → pression vendeuse → souvent cassure **bas**.
- **Symétrique** : les deux se resserrent → cassure dans **le sens de la tendance** précédente.

La cassure se joue souvent avec une **hausse de volume**.`,
    enable: ['autosr', 'structure', 'atr', 'volume'],
    watch: "Cherche un resserrement : trace mentalement deux droites qui convergent. Le volume se contracte-t-il ?",
    prompt:
      "Sur BTC/USDT 5m, le prix dessine-t-il un triangle (ascendant, descendant ou symétrique) ? Dans quel sens la cassure est-elle la plus probable selon la tendance, et le volume/ATR se comprime-t-il ? Explique simplement.",
  },
  {
    id: 'f-drapeaux',
    title: '4 · Drapeaux & fanions',
    goal: 'Repérer une pause de continuation après une impulsion.',
    body: `Après un **mouvement violent** (la « hampe »), le prix respire :

- **Drapeau** : un petit canal incliné **contre** le mouvement.
- **Fanion** : un petit triangle de consolidation.

Ce sont des figures de **continuation** : la cassure dans le sens de l'impulsion projette ≈ la longueur de la hampe. Idéal en tendance forte.`,
    enable: ['structure', 'volume', 'atr'],
    watch: "Repère une forte impulsion suivie d'une petite consolidation inclinée/serrée (la pause avant la suite).",
    prompt:
      "Sur BTC/USDT 5m, vois-tu un drapeau ou un fanion (consolidation après une impulsion) ? Dans quel sens la continuation est-elle attendue et où serait l'objectif approximatif ? Reste pédagogique et prudent.",
  },
  {
    id: 'f-biseaux',
    title: '5 · Biseaux (wedges)',
    goal: 'Distinguer un biseau de retournement.',
    body: `Un **biseau** ressemble à un triangle mais les **deux droites montent (ou descendent)** ensemble :

- **Biseau ascendant** : tout monte mais s'essouffle → souvent **baissier**.
- **Biseau descendant** : tout descend mais ralentit → souvent **haussier**.

À la différence du drapeau, le biseau penche **dans le sens** du mouvement et annonce souvent son **retournement**.`,
    enable: ['structure', 'autosr', 'volume'],
    watch: "Cherche deux droites inclinées dans le même sens qui se resserrent (montant = méfiance haussière).",
    prompt:
      "Sur BTC/USDT 5m, le prix forme-t-il un biseau (ascendant ou descendant) ? Qu'est-ce que son inclinaison suggère comme retournement possible, et qu'est-ce qui le confirmerait ? Pédagogique.",
  },
  {
    id: 'f-cassure',
    title: '6 · Cassure, objectif & faux signaux',
    goal: 'Trader une cassure proprement.',
    body: `Une figure ne se trade qu'à la **cassure** — et toutes ne sont pas vraies :

- **Confirmer** : clôture franche au-delà du niveau, idéalement avec **volume**.
- **Retest** : le prix revient souvent tester la cassure par l'autre côté → meilleure entrée.
- **Objectif** : hauteur de la figure reportée depuis la cassure.
- **Faux signal** (fakeout) : mèche au-delà puis retour dedans → invalidation, on coupe.`,
    enable: ['autosr', 'volume', 'atr'],
    watch: "Surveille une cassure de niveau : la bougie clôture-t-elle franchement au-delà, avec volume, ou n'est-ce qu'une mèche ?",
    prompt:
      "Sur BTC/USDT 5m, une cassure de niveau/figure est-elle en cours ? Est-elle confirmée (clôture + volume) ou suspecte (mèche, faible volume = faux signal possible) ? Y a-t-il eu un retest ? Explique comme à un débutant.",
  },
]

// ──────────────────────── Fibonacci & retracements ────────────────────────

const FIBONACCI: Lesson[] = [
  {
    id: 'fib-pourquoi',
    title: '1 · Pourquoi Fibonacci ?',
    goal: 'Comprendre à quoi servent les retracements.',
    body: `Après une impulsion, le prix **respire** avant de repartir : c'est le **pullback**.

Fibonacci propose des **proportions** où ces pullbacks s'arrêtent souvent : **23,6 % · 38,2 % · 50 % · 61,8 % · 78,6 %**.

L'idée n'est pas magique : ce sont des **zones de décision** où beaucoup de traders surveillent un rebond. On les utilise pour **entrer dans le sens de la tendance**, pas pour deviner un retournement.`,
    enable: ['structure'],
    watch: "Repère la dernière grosse impulsion (jambe) : c'est sur elle qu'on poserait le retracement.",
    prompt:
      "Sur BTC/USDT 5m, identifie la dernière impulsion claire (la « jambe » la plus récente). Dans quel sens va la tendance, et un simple pullback (retracement) serait-il une entrée dans le sens du mouvement ? Explique le principe simplement.",
  },
  {
    id: 'fib-tracer',
    title: '2 · Tracer le retracement',
    goal: 'Poser l\'outil correctement, du bon sens.',
    body: `On trace le retracement **du début à la fin d'une impulsion** :

- **Tendance haussière** : du **creux** (0 %) vers le **sommet** (100 %). Les niveaux apparaissent en dessous, là où le prix pourrait redescendre avant de repartir.
- **Tendance baissière** : du **sommet** vers le **creux**.

Choisis une impulsion **nette** (un swing évident). Mal choisir la jambe = niveaux inutiles.`,
    enable: ['structure', 'autosr'],
    watch: "Identifie le creux et le sommet de la dernière impulsion : ce sont les deux ancres (0 % et 100 %).",
    prompt:
      "Sur BTC/USDT 5m, entre quel creux et quel sommet récents faudrait-il tracer un retracement de Fibonacci pour la tendance actuelle ? Donne-moi les deux points (haut/bas) et le sens. Pédagogique.",
  },
  {
    id: 'fib-golden',
    title: '3 · 0,382 · 0,5 · 0,618 — la zone d\'or',
    goal: 'Cibler les niveaux de pullback les plus utiles.',
    body: `Tous les niveaux ne se valent pas :

- **38,2 %** : pullback peu profond (tendance forte).
- **50 %** : pas un vrai ratio Fibonacci mais très surveillé (équilibre).
- **61,8 %** : le **golden ratio** — avec 65 %, c'est la fameuse **« golden pocket »**, la zone d'entrée privilégiée.
- **78,6 %** : dernier rempart ; au-delà, la jambe est souvent invalidée.

On cherche un **signal** (bougie de rejet) dans la zone 0,5–0,618, pas une entrée aveugle.`,
    enable: ['structure', 'autosr'],
    watch: "Sur la dernière impulsion, situe mentalement la zone 50–61,8 % : le prix s'en approche-t-il ?",
    prompt:
      "Sur BTC/USDT 5m, en supposant un retracement de Fibonacci sur la dernière impulsion : le prix est-il proche d'un niveau clé (38,2 / 50 / 61,8 % — la golden pocket) ? Cherche-t-on un rebond dans le sens de la tendance ici ? Pédagogique, sans garantie.",
  },
  {
    id: 'fib-extensions',
    title: '4 · Extensions : viser les cibles',
    goal: 'Utiliser Fibonacci pour placer des objectifs.',
    body: `Au-delà de 100 %, les **extensions** projettent où le prix pourrait aller **après** le pullback :

- **127,2 %** · **161,8 %** : cibles classiques d'un mouvement de continuation.
- **261,8 %** : objectif étendu en tendance puissante.

Usage : entrée dans la golden pocket, **stop** sous le 78,6 %, **cibles** sur 127 % / 161,8 %. Ça donne un plan complet avec un bon R:R.`,
    enable: ['structure', 'autosr', 'pivots'],
    watch: "Au-delà du sommet de l'impulsion, imagine les paliers 127 % et 161,8 % : coïncident-ils avec un pivot/une résistance ?",
    prompt:
      "Sur BTC/USDT 5m, pour la tendance actuelle, où tomberaient approximativement les extensions de Fibonacci 127 % et 161,8 % comme cibles, et coïncident-elles avec un pivot ou une résistance/support ? Pédagogique.",
  },
  {
    id: 'fib-confluence',
    title: '5 · Confluence = signal fort',
    goal: 'Combiner Fibonacci avec tes autres niveaux.',
    body: `Un niveau de Fibonacci **seul** est faible. Sa force vient de la **confluence** :

- Fib **61,8 %** qui tombe sur un **support/résistance** auto, un **pivot**, le **VWAP** ou un **POC** → zone à très haute probabilité.
- Plusieurs raisons d'agir **au même prix** = signal bien plus fiable qu'un Fib isolé.

> C'est la même logique que toute la formation : **un seul outil ment souvent, plusieurs alignés rarement.**`,
    enable: ['structure', 'autosr', 'pivots', 'vwap'],
    watch: "Cherche un endroit où un niveau de Fibonacci coïncide avec une S/R, un pivot ou le VWAP.",
    prompt:
      "Sur BTC/USDT 5m, y a-t-il une zone où un niveau de Fibonacci probable coïncide avec un support/résistance, un pivot ou le VWAP (confluence) ? Pourquoi cette zone serait-elle plus fiable ? Explique simplement.",
  },
]

// ──────────────────────── Smart Money & liquidité ────────────────────────

const SMC: Lesson[] = [
  {
    id: 'smc-bos-choch',
    title: '1 · BOS & CHoCH',
    goal: 'Lire la structure comme les institutionnels.',
    body: `Le cœur des Smart Money Concepts, c'est la **structure** :

- **BOS** (Break of Structure) : le prix casse le dernier sommet/creux **dans le sens** de la tendance → **continuation**.
- **CHoCH** (Change of Character) : il casse **contre** la tendance (premier creux cassé en hausse) → **premier signe de retournement**.

Lire BOS/CHoCH te dit **qui contrôle** le marché avant tout indicateur.`,
    enable: ['structure', 'autosr'],
    watch: "Suis les sommets/creux (HH/HL/LH/LL) : la dernière cassure va-t-elle dans le sens de la tendance (BOS) ou contre (CHoCH) ?",
    prompt:
      "Sur BTC/USDT 5m, d'après la structure (HH/HL/LH/LL), la dernière cassure significative est-elle un BOS (continuation) ou un CHoCH (changement de caractère) ? Qui contrôle le marché là maintenant ? Pédagogique.",
  },
  {
    id: 'smc-orderblocks',
    title: '2 · Order blocks',
    goal: 'Repérer la dernière bougie avant une impulsion.',
    body: `Un **order block** = la **dernière bougie opposée** juste avant un mouvement impulsif (souvent une zone d'ordres institutionnels).

- **Bullish OB** : la dernière bougie rouge avant une forte hausse → zone de **demande**.
- **Bearish OB** : la dernière bougie verte avant une forte baisse → zone d'**offre**.

Le prix revient souvent **« mitiger »** (retester) cet order block avant de repartir : c'est une zone d'entrée recherchée.`,
    enable: ['structure', 'volumeProfile'],
    watch: "Repère une impulsion forte, puis la dernière bougie de couleur opposée juste avant son départ.",
    prompt:
      "Sur BTC/USDT 5m, repères-tu un order block récent (dernière bougie opposée avant une forte impulsion) ? Le prix est-il revenu le tester (mitigation) ou pourrait-il y revenir ? Reste pédagogique et prudent.",
  },
  {
    id: 'smc-liquidite',
    title: '3 · Liquidité & stop hunts',
    goal: 'Comprendre pourquoi le prix « chasse » les stops.',
    body: `Sous les **creux** et au-dessus des **sommets** s'accumulent les **stops** : c'est de la **liquidité**.

- **Equal highs/lows** : plusieurs extrêmes au même prix = liquidité évidente, comme une cible.
- **Liquidity grab / stop hunt** : le prix pique au-delà pour déclencher ces stops… puis repart dans l'autre sens.
- Ta **heatmap de liquidations** montre justement ces poches d'aimants en crypto.`,
    enable: ['structure', 'liquidations'],
    watch: "Repère des sommets/creux « égaux » et regarde la heatmap : une poche de liquidité proche que le prix pourrait chasser ?",
    prompt:
      "Sur BTC/USDT 5m, y a-t-il des zones de liquidité évidentes (sommets/creux égaux) ou un cluster sur la heatmap de liquidations que le prix pourrait venir chasser (stop hunt) ? Qu'est-ce que ça implique ? Rappelle que la heatmap est une estimation.",
  },
  {
    id: 'smc-fvg',
    title: '4 · Fair Value Gaps (imbalances)',
    goal: 'Repérer les déséquilibres que le prix vient combler.',
    body: `Un **Fair Value Gap (FVG)** = un **trou** laissé par un mouvement trop rapide : trois bougies où la mèche de la 1ʳᵉ et celle de la 3ᵉ ne se chevauchent pas.

- Ce vide est une **inefficience** : le prix a tendance à **revenir le combler** avant de continuer.
- Un FVG agit comme une **zone d'aimant** puis de **rebond** dans le sens de l'impulsion.`,
    enable: ['structure', 'volume'],
    watch: "Cherche une impulsion à 3 bougies très rapides laissant un « trou » de prix non recouvert (le FVG).",
    prompt:
      "Sur BTC/USDT 5m, repères-tu un Fair Value Gap récent (vide laissé par une impulsion rapide à 3 bougies) ? Le prix est-il susceptible de revenir le combler, et dans quel sens repartir ensuite ? Explique simplement.",
  },
  {
    id: 'smc-premium',
    title: '5 · Premium / Discount',
    goal: 'Acheter bas, vendre haut — version institutionnelle.',
    body: `Sur une jambe de marché, on divise la zone en deux par le **milieu (50 %, l'équilibre)** :

- **Discount** (sous 50 %) : zone « pas chère » → on cherche des **achats**.
- **Premium** (au-dessus de 50 %) : zone « chère » → on cherche des **ventes**.

Combiné à un **order block** en discount ou à la **golden pocket** Fibonacci, ça affine fortement les entrées. Le VWAP aide à situer cet équilibre.`,
    enable: ['structure', 'vwap', 'autosr'],
    watch: "Situe le prix sur la dernière jambe : est-il dans la moitié basse (discount) ou haute (premium) ? De quel côté du VWAP ?",
    prompt:
      "Sur BTC/USDT 5m, par rapport à la dernière jambe et au VWAP, le prix est-il en zone premium (chère) ou discount (pas chère) ? Cela favorise-t-il plutôt des achats ou des ventes selon la logique SMC ? Pédagogique.",
  },
  {
    id: 'smc-plan',
    effort: 'high',
    title: '6 · Le plan : sweep → CHoCH → OB',
    goal: 'Assembler un setup SMC complet.',
    body: `Le scénario type qui réunit tout :

1. **Sweep de liquidité** : le prix chasse un creux/sommet évident (stop hunt).
2. **CHoCH** : il casse la structure dans l'autre sens → le caractère change.
3. **Order block / FVG** : il revient mitiger une zone en **discount/premium**.
4. **Entrée** sur la zone, **stop** au-delà du sweep, **cible** sur la liquidité opposée.

> Beaucoup de pièces — n'agis que si **plusieurs s'alignent**. Sinon, on observe.`,
    enable: ['structure', 'liquidations', 'volumeProfile', 'vwap'],
    watch: "Cherche l'enchaînement : un sweep récent, puis une cassure de structure opposée (CHoCH), puis une zone de retour.",
    prompt:
      "Sur BTC/USDT 5m, vois-tu un enchaînement SMC en cours — sweep de liquidité, puis CHoCH, puis retour vers un order block / FVG ? Combien d'éléments sont alignés et quel scénario prudent en tirer (sans conseil financier) ? Pédagogique.",
  },
]

// ──────────────────────── Psychologie & discipline ────────────────────────

const PSYCHO: Lesson[] = [
  {
    id: 'p-emotions',
    title: '1 · Peur, avidité & FOMO',
    goal: 'Reconnaître les deux émotions qui ruinent les comptes.',
    body: `Deux émotions primaires dictent les mauvaises décisions :

- **Avidité / FOMO** : entrer en retard sur une bougie qui s'envole, par peur de « rater ».
- **Peur** : couper un bon trade trop tôt, ou refuser de prendre sa perte.

Le marché est conçu pour **déclencher** ces réflexes. La parade : un **plan défini à l'avance**, qu'on suit même quand l'émotion crie le contraire.`,
    enable: [],
    watch: "Observe-toi : ressens-tu une envie d'entrer « tout de suite » sur le dernier mouvement ? C'est souvent le FOMO.",
    prompt:
      "Joue le rôle d'un coach de trading. Le marché BTC/USDT vient de faire un mouvement et je ressens du FOMO (peur de rater). Explique-moi pourquoi entrer maintenant par impulsion est risqué, et quelle question me poser avant d'agir. Bienveillant et concret.",
  },
  {
    id: 'p-biais',
    title: '2 · Revenge trading & biais',
    goal: 'Repérer les pièges mentaux après une perte.',
    body: `Après une perte, le cerveau veut **« se refaire »** — c'est le piège :

- **Revenge trading** : reprendre un trade non planifié pour effacer la perte → spirale.
- **Overtrading** : trop de trades par ennui → frais et erreurs.
- **Biais de confirmation** : ne voir que ce qui valide ton idée.
- **Aversion à la perte** : tenir un perdant en espérant qu'il « revienne ».

La règle : après une grosse perte, on **fait une pause**.`,
    enable: [],
    watch: "Si tu viens de perdre, repère l'envie immédiate de « reprendre tout de suite » : c'est le signal d'arrêt.",
    prompt:
      "En tant que coach de trading : je viens de prendre une perte et j'ai envie de la « récupérer » tout de suite avec un nouveau trade. Explique-moi le revenge trading et donne-moi une règle simple pour ne pas tomber dedans. Bref et concret.",
  },
  {
    id: 'p-plan',
    title: '3 · Le plan de trading',
    goal: 'Décider avant, exécuter sans émotion.',
    body: `Un trade se décide **avant** d'entrer, jamais en plein mouvement. Ton plan répond à :

- **Entrée** : à quelle condition précise j'entre ?
- **Stop** : où mon idée est-elle invalidée ?
- **Cible** : où je sors, pour quel R:R (≥ 1:2) ?
- **Risque** : combien je perds si ça tourne mal (≤ 1%) ?

Écrit noir sur blanc, le plan transforme le trading d'un **pari émotionnel** en **process répétable**.`,
    enable: ['atr'],
    watch: "Avant tout trade, écris les 4 lignes : entrée / stop / cible / risque. Pas de plan = pas de trade.",
    prompt:
      "En coach pédagogique : aide-moi à transformer une idée en plan sur BTC/USDT. À partir de l'ATR et du prix actuels, montre un exemple de plan structuré (entrée, stop, cible R:R 1:2, risque 1%) et insiste sur le fait de tout définir AVANT d'entrer. Sans conseil financier personnalisé.",
  },
  {
    id: 'p-journal',
    title: '4 · Le journal de trading',
    goal: 'Progresser en analysant tes propres trades.',
    body: `Le **journal** est l'outil n°1 de progression. Pour chaque trade, note :

- Le **setup** (pourquoi j'entre), une **capture** du graphe.
- **Émotion** ressentie à l'entrée et à la sortie.
- **Résultat** et surtout : ai-je **suivi mon plan** ? (un trade peut être perdant *et* bien joué).

Relis **20–30 trades** d'un coup : tes erreurs récurrentes sautent aux yeux. On corrige le **process**, pas un trade isolé.`,
    enable: [],
    watch: "Repère ton dernier trade (réel ou simulé) : pourrais-tu le décrire en 3 lignes — setup, émotion, respect du plan ?",
    prompt:
      "En coach de trading : explique-moi comment tenir un journal de trading utile (quoi noter pour chaque trade) et pourquoi un trade perdant mais conforme au plan est un « bon » trade. Donne 4-5 champs concrets à consigner. Pédagogique.",
  },
  {
    id: 'p-pertes',
    title: '5 · Gérer pertes & drawdown',
    goal: 'Tenir psychologiquement dans les séries perdantes.',
    body: `Même une stratégie gagnante enchaîne des **séries de pertes** — c'est mathématique.

- Raisonne en **probabilités sur 100 trades**, pas trade par trade.
- Un **drawdown** (recul du capital) est normal ; ce qui compte, c'est qu'il reste **limité** grâce au risque fixe.
- Après plusieurs pertes : **réduis la taille** ou fais une pause, ne l'augmente jamais pour « te refaire ».

> Le but n'est pas d'avoir raison souvent, mais de **survivre** assez longtemps pour que ton avantage s'exprime.`,
    enable: ['atr'],
    watch: "Demande-toi : si je perdais 5 trades d'affilée, mon capital tiendrait-il sans panique ? Si non, ton risque est trop élevé.",
    prompt:
      "En coach pédagogique : explique-moi pourquoi une série de pertes est normale même avec une bonne stratégie, et comment gérer un drawdown sainement (risque fixe, taille réduite, pause). Rassurant mais réaliste, sans promesse de gains.",
  },
  {
    id: 'p-routine',
    title: '6 · Routine & patience',
    goal: 'Attendre SON setup plutôt que trader pour trader.',
    body: `Les meilleurs traders **attendent** — ils ne sont pas tout le temps en position :

- **Patience** : si aucune condition n'est réunie, le meilleur trade est **de ne rien faire**.
- **Routine** : mêmes horaires, mêmes vérifications, mêmes critères → moins de décisions émotionnelles.
- **Qualité > quantité** : quelques setups A+ valent mieux que dix trades médiocres.

> *« Le marché paie la patience, pas l'activité. »*`,
    enable: ['sessions'],
    watch: "Regarde la session active : est-ce une période propice (ouverture US, chevauchement) ou plutôt calme à laisser passer ?",
    prompt:
      "En coach de trading : en tenant compte de la session de marché actuellement active sur le graphe, est-ce plutôt une période propice à l'action ou une à laisser passer ? Rappelle-moi pourquoi la patience (attendre un setup de qualité) bat l'activité permanente. Pédagogique.",
  },
]

// ──────────────────────── Méthode Wyckoff ────────────────────────

const WYCKOFF: Lesson[] = [
  {
    id: 'w-lois',
    title: '1 · Les 3 lois de Wyckoff',
    goal: 'Comprendre la logique offre/demande de fond.',
    body: `Wyckoff lit le marché comme l'œuvre d'un **opérateur composite** (les mains fortes). Trois lois :

- **Offre & Demande** : le prix monte quand la demande dépasse l'offre (et l'inverse).
- **Cause & Effet** : une **phase d'accumulation** (la cause) prépare un mouvement proportionnel (l'effet).
- **Effort vs Résultat** : le **volume** est l'effort. Un gros volume **sans** progression du prix = **divergence** (quelqu'un absorbe).`,
    enable: ['volume', 'volumeProfile'],
    watch: "J'ai activé Volume + Volume Profile. Cherche un gros volume qui ne fait **pas** avancer le prix (effort sans résultat).",
    prompt:
      "Sur BTC/USDT, en appliquant la loi « effort vs résultat » de Wyckoff : vois-tu récemment un volume important qui ne se traduit pas par une progression du prix (signe d'absorption) ? Explique simplement.",
  },
  {
    id: 'w-cycle',
    effort: 'high',
    title: '2 · Le cycle en 4 phases',
    goal: 'Situer le marché dans son cycle.',
    body: `Wyckoff découpe le marché en **4 phases** qui se répètent :

1. **Accumulation** : range bas, les mains fortes achètent discrètement.
2. **Markup** : la hausse (tendance).
3. **Distribution** : range haut, elles revendent à la foule.
4. **Markdown** : la baisse.

Identifier la phase, c'est savoir s'il faut **acheter les creux**, **suivre la tendance** ou **se méfier**.`,
    enable: ['volumeProfile'],
    watch: "Volume Profile activé : le prix est-il dans un range (zone épaisse = accumulation/distribution) ou en tendance ?",
    prompt:
      "Sur BTC/USDT, dans quelle phase du cycle de Wyckoff (accumulation, markup, distribution, markdown) le marché semble-t-il se trouver, d'après la structure et le Volume Profile actuels ? Pédagogique et prudent.",
  },
  {
    id: 'w-accumulation',
    title: "3 · Schéma d'accumulation",
    goal: 'Lire un range de creux étape par étape.',
    body: `Dans une **accumulation**, le prix construit un plancher en plusieurs étapes :

- **SC** (Selling Climax) : vente panique, gros volume.
- **AR** (Automatic Rally) puis **ST** (Secondary Test) : les bornes du range.
- **Spring** : faux plongeon sous le support pour **piéger les vendeurs** (chasse de liquidité).
- **SOS** (Sign of Strength) + **LPS** (Last Point of Support) : la sortie par le haut.

> Le **Spring** est la clé : il aspire les stops avant le markup.`,
    enable: ['autosr', 'volumeProfile'],
    watch: "Cherche un range de creux : un faux plongeon sous le support (Spring) suivi d'un retour dedans est le signal-clé.",
    prompt:
      "Sur BTC/USDT, le prix dessine-t-il un schéma d'accumulation Wyckoff (range de creux, éventuel Spring sous le support) ? Où en sommes-nous et qu'est-ce qui le confirmerait ? Pédagogique, sans garantie.",
  },
  {
    id: 'w-distribution',
    title: '4 · Schéma de distribution',
    goal: 'Lire un range de sommet (le miroir).',
    body: `La **distribution** est le miroir de l'accumulation, en haut :

- **BC** (Buying Climax) : achat euphorique, gros volume.
- **AR** / **ST** : les bornes du range haut.
- **UTAD** (UpThrust After Distribution) : fausse cassure au-dessus de la résistance pour **piéger les acheteurs**.
- **SOW** (Sign of Weakness) + **LPSY** (Last Point of Supply) : la sortie par le bas.

> L'**UTAD** est le Spring inversé : il aspire les stops des shorts avant le markdown.`,
    enable: ['autosr', 'volumeProfile'],
    watch: "Cherche un range de sommet : une fausse cassure au-dessus de la résistance (UTAD) puis un retour dedans = alerte.",
    prompt:
      "Sur BTC/USDT, vois-tu un schéma de distribution Wyckoff (range de sommet, éventuel UTAD au-dessus de la résistance) ? Qu'est-ce qui le confirmerait ou l'invaliderait ? Prudent et pédagogique.",
  },
  {
    id: 'w-spring',
    title: '5 · Spring & Upthrust : les pièges',
    goal: 'Relier Wyckoff à la liquidité et au volume.',
    body: `**Spring** et **UTAD** sont des **pièges à liquidité** : une mèche au-delà du range pour déclencher les stops, puis un retour brutal.

- Un bon Spring se fait souvent sur une **cascade de liquidations** (longs purgés) puis un rejet net.
- C'est la même idée que le **stop hunt** des Smart Money Concepts, vue côté **volume/effort**.

Vérifie l'**effort vs résultat** : la mèche pique fort mais le prix **revient** dedans = le piège a fonctionné.`,
    enable: ['volume', 'liquidations'],
    watch: "Volume + liquidations activés. Une mèche hors du range avec pic de liquidations puis rejet = Spring/UTAD probable.",
    prompt:
      "Sur BTC/USDT, repères-tu une mèche hors d'un range récente avec un pic de liquidations puis un rejet (Spring ou Upthrust de Wyckoff = piège à liquidité) ? De quel côté les stops ont-ils été chassés ? Pédagogique, sans garantie.",
  },
  {
    id: 'w-vprofile',
    effort: 'high',
    title: '6 · Wyckoff + Volume Profile',
    goal: 'Ancrer le range avec le Volume Profile.',
    body: `Wyckoff et le **Volume Profile** se complètent parfaitement :

- Le **range** d'accumulation/distribution correspond souvent à une **Value Area** (zone de fort volume).
- Le **POC** (prix le plus échangé) agit comme **aimant** et pivot du range.
- Une sortie de range **loin du POC** avec volume = le markup/markdown s'enclenche.

> Le POC te donne le **centre de gravité** ; Wyckoff te donne le **scénario**.`,
    enable: ['volumeProfile', 'vwap'],
    watch: "Volume Profile activé : le POC est-il au centre d'un range (accumulation/distribution) ? Le prix s'en éloigne-t-il ?",
    prompt:
      "Sur BTC/USDT, en combinant Wyckoff et le Volume Profile : le prix est-il dans un range autour du POC (accumulation/distribution) ou en train d'en sortir (markup/markdown) ? Qu'en déduire prudemment ? Pédagogique.",
  },
]

// ──────────────────────── Dérivés & sentiment ────────────────────────

const DERIVES: Lesson[] = [
  {
    id: 'd-perp',
    title: '1 · Le perpétuel & le funding',
    goal: 'Comprendre pourquoi un perpétuel colle au prix spot.',
    body: `Un **contrat perpétuel** (« perp ») est un future **sans date d'expiration** — le produit le plus traité en crypto.

Sans échéance, qu'est-ce qui l'empêche de dériver loin du spot ? Le **funding** : un petit paiement échangé périodiquement (souvent toutes les 8 h) **entre longs et shorts**.

- Perp **au-dessus** du spot → funding **positif** → les **longs paient les shorts** (ça refroidit les longs).
- Perp **en dessous** → funding **négatif** → les **shorts paient les longs**.

C'est un **ressort** qui arrime le perp au spot.`,
    enable: [],
    watch: "Ouvre l'onglet **Order flow** : repère le bloc « Perpétuel » (Funding, Mark, prochain paiement, Basis).",
    prompt:
      "Explique-moi, à partir du funding et du mark price actuels de BTC/USDT, dans quel sens le perpétuel est tiré par rapport au spot et qui paie qui (longs ou shorts) au prochain funding. Pédagogique.",
  },
  {
    id: 'd-funding',
    title: '2 · Lire le funding rate',
    goal: 'Déduire le positionnement de la foule.',
    body: `Le **signe et l'ampleur** du funding révèlent le **positionnement** :

- **Positif** : foule **longue** (sentiment haussier). *Dans l'app il s'affiche en rouge* — car des longs trop nombreux = risque.
- **Négatif** : foule **short** (sentiment baissier), affiché en vert.
- **Extrême** : marché **sur-effet de levier** d'un côté → lecture **contrarian**, le carburant d'un futur squeeze.

> Un funding élevé n'est pas une confirmation de tendance : c'est un **avertissement de risque**.`,
    enable: [],
    watch: "Order flow → « Funding ». Est-il positif (rouge) ou négatif (vert), et proche de 0 ou élevé ?",
    prompt:
      "D'après le funding rate actuel de BTC/USDT : la foule est-elle plutôt longue ou short, et le niveau est-il neutre ou extrême (zone contrarian) ? Qu'est-ce que ça implique prudemment ? Rappelle que c'est du sentiment, pas un signal direct.",
  },
  {
    id: 'd-oi',
    title: '3 · Open Interest : les 4 quadrants',
    goal: 'Croiser variation de prix et open interest.',
    body: `L'**Open Interest (OI)** = le nombre total de contrats **ouverts**. Croisé avec le prix, il dit si un mouvement est porté par de **l'argent neuf** :

- **Prix ↑ + OI ↑** = **nouveaux longs** → tendance **confirmée** (conviction).
- **Prix ↓ + OI ↑** = **nouveaux shorts** → baisse **confirmée**.
- **Prix ↑ + OI ↓** = **rachat de shorts** (short covering) → hausse **fragile**.
- **Prix ↓ + OI ↓** = **longs qui débouclent** → baisse qui **s'essouffle**.

> Règle d'or : un **OI qui monte confirme** la tendance ; un **OI qui baisse** = elle perd de la force.`,
    enable: [],
    watch: "Order flow → « Open Interest ». Compare son évolution récente avec celle du prix.",
    prompt:
      "En croisant le prix récent de BTC/USDT et l'open interest actuel, dans lequel des 4 quadrants sommes-nous (prix ↑/↓ × OI ↑/↓) ? Le mouvement est-il porté par de l'argent neuf (conviction) ou par des débouclages (fragile) ? Pédagogique.",
  },
  {
    id: 'd-basis',
    title: '4 · Basis & premium',
    goal: "Mesurer l'écart perp/spot.",
    body: `Le **basis** = **mark price (perp) − prix spot**.

- **Basis positif** (perp > spot, *contango*) : prime haussière, levier long dominant → souvent funding positif.
- **Basis négatif** (perp < spot, *backwardation*) : décote, pression short → funding négatif.

L'ampleur du basis et du funding mesure l'**appétit pour le levier**. Annualisé, le funding (≈ taux × 1 095 pour des paiements de 8 h) se lit comme un **rendement** — la base du *cash-and-carry*.`,
    enable: [],
    watch: "Order flow → « Basis ». Positif (vert) = perp au-dessus du spot ; négatif (rouge) = en dessous.",
    prompt:
      "À partir du basis (mark − spot) et du funding actuels de BTC/USDT : sommes-nous en contango (prime, levier long) ou en backwardation (décote, pression short) ? Que dit l'ampleur sur l'appétit pour le levier ? Simple et concret.",
  },
  {
    id: 'd-squeeze',
    effort: 'high',
    title: '5 · OI élevé + funding extrême = squeeze',
    goal: 'Anticiper un flush de levier.',
    body: `Le cocktail dangereux : **OI élevé** (beaucoup de positions à levier) **+ funding extrême** (foule très penchée d'un côté).

- Foule **très longue** (funding très positif) → une petite baisse liquide des longs → **vente forcée** → cascade baissière (*long squeeze*).
- Foule **très short** (funding très négatif) → une hausse liquide des shorts → **achat forcé** → *short squeeze*.

Ta **heatmap de liquidations** montre où ces positions sautent : des **aimants** que le prix vient chercher.`,
    enable: ['liquidations'],
    watch: "J'ai activé la heatmap de liquidations. Croise-la avec funding + OI (onglet Order flow) : la foule est-elle sur-positionnée ?",
    prompt:
      "En combinant l'open interest, le funding et la heatmap/flux de liquidations actuels de BTC/USDT : le marché est-il sur-positionné d'un côté (risque de squeeze) ? De quel côté un flush de levier serait-il le plus probable et vers quel cluster ? Rappelle que la heatmap est une estimation.",
  },
  {
    id: 'd-regime',
    effort: 'high',
    title: '6 · Synthèse : lire le régime',
    goal: 'Assembler funding + OI + liquidations en une lecture.',
    body: `Mets tout ensemble pour classer le **régime** :

- **Tendance saine** : prix et OI montent ensemble, funding **modéré** → conviction, pas de sur-levier.
- **Surchauffe** : funding extrême + OI au plus haut → squeeze probable, on réduit le risque.
- **Capitulation** : cascade de liquidations + OI qui chute → débouclage massif, un creux/sommet peut se former.

> Le prix dit *quoi* ; funding, OI et liquidations disent *avec quelle solidité*.`,
    enable: ['liquidations'],
    watch: "Regarde ensemble : prix, funding, OI (Order flow) et liquidations. Quelle histoire racontent-ils ?",
    prompt:
      "Fais une synthèse du régime actuel de BTC/USDT en croisant prix, open interest, funding et liquidations : tendance saine, surchauffe (risque de squeeze) ou capitulation ? Conclus prudemment, sans conseil financier.",
  },
]

// ──────────────────────── Order flow & carnet ────────────────────────

const ORDERFLOW: Lesson[] = [
  {
    id: 'o-aggresseur',
    title: "1 · Marché vs limite : l'agresseur",
    goal: 'Comprendre qui fait réellement bouger le prix.',
    body: `Deux types d'ordres :

- **Ordre limite** : posé dans le **carnet**, il **attend** d'être touché (liquidité passive).
- **Ordre au marché** : exécuté **immédiatement** en consommant le carnet — c'est l'**agresseur** qui fait bouger le prix.

Le **DOM** (Depth Of Market, le carnet) montre la liquidité passive empilée. L'order flow, c'est lire **qui agresse** (acheteurs/vendeurs) et **où est la liquidité**.`,
    enable: [],
    watch: "Order flow → l'échelle du carnet (ladder) : asks en rouge au-dessus, bids en vert en dessous du prix.",
    prompt:
      "Explique-moi simplement, avec l'état actuel du carnet de BTC/USDT, la différence entre la liquidité passive (les ordres affichés) et les agresseurs (ordres au marché) qui font bouger le prix. Pédagogique.",
  },
  {
    id: 'o-imbalance',
    title: '2 · Imbalance & spread',
    goal: 'Lire le déséquilibre du carnet.',
    body: `Deux mesures clés du carnet :

- **Imbalance** : la part de **bids** (achat) vs **asks** (vente). Plus de bids = pression acheteuse / support sous le prix.
- **Spread** : l'écart meilleur ask − meilleur bid. **Serré** = marché liquide ; **large** = peu de liquidité, mouvements brusques.

> Attention : un **gros mur** d'ordres peut être du **spoofing** (retiré avant d'être touché). L'imbalance se lit en **dynamique**, pas comme une vérité figée.`,
    enable: [],
    watch: "Order flow → barre « imbalance » (% bid / % ask) et le « spread ». Penché côté achat ou vente ?",
    prompt:
      "D'après l'imbalance et le spread actuels du carnet de BTC/USDT : la pression est-elle côté acheteur ou vendeur, et la liquidité est-elle bonne (spread serré) ou faible ? Que surveiller ? Rappelle qu'un mur peut être du spoofing.",
  },
  {
    id: 'o-cvd',
    title: '3 · Delta & CVD',
    goal: "Mesurer l'agression nette.",
    body: `Le **delta** d'une bougie = volume **acheteur agressif − vendeur agressif**.

- Delta **positif** = les acheteurs au marché dominent ; négatif = les vendeurs.
- Le **CVD** (Cumulative Volume Delta) **additionne** ces deltas dans le temps : sa pente montre qui **contrôle** vraiment le flux.

Plus fin que le volume : le volume dit *combien*, le delta dit *de quel côté*.`,
    enable: ['volume'],
    watch: "J'ai activé le Volume. Imagine, derrière chaque barre, le solde acheteurs/vendeurs agressifs (le delta).",
    prompt:
      "À partir du volume et du déroulé récent de BTC/USDT, raisonne en termes de delta/CVD : les acheteurs ou les vendeurs agressifs semblent-ils contrôler le flux en ce moment ? Explique le concept simplement, sans prétendre au tick exact.",
  },
  {
    id: 'o-divergence',
    title: '4 · Divergence de CVD',
    goal: "Repérer l'épuisement d'un côté.",
    body: `Comme pour le RSI, une **divergence** entre prix et CVD trahit un essoufflement :

- Prix fait un **plus-haut**, CVD un **plus-bas** (ou plat) = **épuisement des acheteurs** → risque de retournement baissier.
- Prix fait un **plus-bas**, CVD un **plus-haut** = **épuisement des vendeurs** → rebond possible.

Le prix avance, mais **sans agression nette** derrière : le carburant manque.`,
    enable: ['volume'],
    watch: "Cherche un nouveau plus-haut/plus-bas du prix qui ne serait **pas** accompagné d'un volume agressif convaincant.",
    prompt:
      "Sur BTC/USDT, le dernier plus-haut ou plus-bas du prix est-il soutenu par le volume/flux agressif, ou vois-tu un signe de divergence (prix qui avance sans conviction) ? Qu'est-ce que ça suggérerait ? Pédagogique et prudent.",
  },
  {
    id: 'o-absorption',
    title: '5 · Absorption & épuisement',
    goal: 'Voir un côté passif encaisser l\'agression.',
    body: `L'**absorption** : le prix **n'avance plus** alors qu'un côté **continue d'agresser**.

- Les vendeurs frappent fort mais le prix **ne baisse plus** → un gros acheteur **passif absorbe** → retournement haussier probable.
- L'inverse au sommet : les acheteurs s'épuisent contre un mur vendeur.

Signal puissant : l'**effort** est là, mais pas le **résultat** (un principe qu'on retrouve chez Wyckoff).`,
    enable: ['liquidations'],
    watch: "Repère un niveau où le prix bute et stagne malgré des bougies actives et des liquidations : quelqu'un absorbe.",
    prompt:
      "Sur BTC/USDT, vois-tu une zone où le prix stagne malgré une forte activité (volume, liquidations) — un signe d'absorption par le côté passif ? De quel côté, et qu'est-ce que ça impliquerait ? Pédagogique.",
  },
  {
    id: 'o-liquidations',
    title: '6 · Les liquidations comme order flow',
    goal: 'Lire les liquidations comme du flux forcé.',
    body: `Une **liquidation** est de l'order flow **forcé** : une position à levier fermée d'office au marché.

- **Longs liquidés** (rouge) = **vente** forcée → peut marquer un **creux** (capitulation).
- **Shorts liquidés** (vert) = **achat** forcé → peut marquer un **sommet** (short squeeze).
- Les **whales** (≥ 100 000 $) pèsent plus lourd.

La **heatmap** cartographie où ces stops s'empilent : une **carte de liquidité** que le prix vient souvent chercher.`,
    enable: ['liquidations'],
    watch: "Order flow → cartes « Longs/Shorts liquidés » + flux. Et la heatmap sur le graphe : un cluster proche ?",
    prompt:
      "D'après le flux de liquidations (longs vs shorts, whales) et la heatmap de BTC/USDT : y a-t-il une vente ou un achat forcé dominant, et un cluster proche que le prix pourrait chasser ? Creux ou sommet potentiel ? Rappelle que c'est une estimation.",
  },
]

// ──────────────────────── Analyse multi-timeframe ────────────────────────

const MTF: Lesson[] = [
  {
    id: 'm-pourquoi',
    title: '1 · Pourquoi top-down',
    goal: 'Partir du grand pour aller vers le petit.',
    body: `L'**analyse top-down** part de la **grande unité de temps (HTF)** vers la petite :

- La HTF donne le **biais** (direction de fond) et les **niveaux majeurs**.
- La petite UT sert juste à **timer** l'entrée **dans le sens** de la HTF.

Faire l'inverse (bottom-up) = se noyer dans le bruit et trader contre la tendance de fond. **Le contexte d'abord, le timing ensuite.**`,
    enable: [],
    watch: "Change l'unité de temps en haut du graphe : compare la tendance en 1h/4h avec celle en 5m.",
    prompt:
      "Explique-moi le principe de l'analyse top-down et pourquoi définir le biais sur une grande unité de temps avant d'entrer en 5m. Applique-le à BTC/USDT : quelle serait la première question à se poser ? Pédagogique.",
  },
  {
    id: 'm-stack',
    title: '2 · La pile de 3 UT (ratio 4:1–8:1)',
    goal: 'Choisir 3 unités de temps cohérentes.',
    body: `On empile **3 unités de temps**, espacées d'un **ratio 4:1 à 8:1** :

- **HTF** (contexte / biais) — ex. Daily ou 4h.
- **MTF** (structure / niveaux) — ex. 1h.
- **LTF** (déclencheur / entrée) — ex. 5–15m.

Exemple : **4h → 1h → 15m**. Trop d'écart = niveaux déconnectés ; trop peu = trois fois la même image.`,
    enable: ['autosr'],
    watch: "S/R auto activés : note un niveau majeur en 4h, puis repasse en 5m pour voir comment le prix y réagit.",
    prompt:
      "Pour trader BTC/USDT en 5m, propose-moi une pile cohérente de 3 unités de temps (ratio 4:1–8:1) et explique le rôle de chacune (biais / structure / déclencheur). Concret et simple.",
  },
  {
    id: 'm-contexte',
    title: '3 · Le contexte HTF pour les données live',
    goal: 'Cadrer funding, OI et sessions dans la HTF.',
    body: `Les données live se lisent mieux **avec le biais HTF** :

- Un **funding** extrême ou un **OI** au plus haut pèsent davantage **contre** la tendance de fond (risque de squeeze à contre-sens).
- Un signal LTF qui **va dans le sens** de la HTF est bien plus fiable qu'un signal isolé.

> La donnée live affine le **timing** ; la HTF décide de la **direction**.`,
    enable: [],
    watch: "Garde le biais 4h en tête, puis regarde funding/OI (Order flow) : confortent-ils ou contredisent-ils ce biais ?",
    prompt:
      "Pour BTC/USDT, en supposant un biais de fond donné par la grande unité de temps, comment le funding et l'open interest actuels viennent-ils confirmer ou nuancer ce biais ? Explique comment combiner contexte HTF et données live. Pédagogique.",
  },
  {
    id: 'm-sessions',
    title: '4 · Timing par session',
    goal: 'Adapter son trading à l\'heure du marché.',
    body: `Le marché **respire** selon les sessions (fond coloré du graphe) :

- **Asie** : souvent **calme**, ranges.
- **Londres** : reprise de **volatilité**.
- **New York (US)** : gros volume ; le **chevauchement Londres ↔ NY** (≈ 13–16 h UTC) est la période **la plus active**.

Adapte ton style : range en Asie, **momentum** à l'ouverture US. Beaucoup de cassures se jouent sur ces ouvertures.`,
    enable: ['sessions'],
    watch: "Les Sessions sont activées (bandes de fond). Quelle session est active maintenant, et est-on dans un chevauchement ?",
    prompt:
      "Quelle session de marché est active actuellement sur BTC/USDT (Asie/Londres/NY), sommes-nous dans le chevauchement Londres-NY, et qu'est-ce que ça implique pour la volatilité attendue et le style à adopter ? Pédagogique.",
  },
]

// ───────────────────────────────── Registry ─────────────────────────────────

// Order = the pedagogical learning path (see PHASES below): foundations →
// technical toolbox → advanced market reading → the transversal mental game.
export const MODULES: Module[] = [
  // ── Fondations ──
  {
    id: 'essentiel',
    title: 'Parcours essentiel',
    tagline: 'Du graphe à une vraie stratégie, pas à pas.',
    icon: '🎓',
    level: 'Débutant',
    lessons: ESSENTIEL,
  },
  {
    id: 'chandeliers',
    title: 'Chandeliers japonais',
    tagline: 'Les figures en bougies qui annoncent les retournements.',
    icon: '🕯️',
    level: 'Débutant',
    lessons: CHANDELIERS,
  },
  // ── Boîte à outils technique ──
  {
    id: 'indicateurs',
    title: 'Maîtrise par indicateur',
    tagline: 'Un indicateur à la fois, lu en direct sur le marché.',
    icon: '🎛️',
    level: 'Intermédiaire',
    lessons: INDICATEURS,
  },
  {
    id: 'figures',
    title: 'Figures chartistes',
    tagline: 'Tête-épaules, triangles, drapeaux & cassures.',
    icon: '📐',
    level: 'Intermédiaire',
    lessons: FIGURES,
  },
  {
    id: 'fibonacci',
    title: 'Fibonacci & retracements',
    tagline: 'Pullbacks, golden pocket et cibles par extension.',
    icon: '🌀',
    level: 'Intermédiaire',
    lessons: FIBONACCI,
  },
  {
    id: 'mtf',
    title: 'Analyse multi-timeframe',
    tagline: "L'approche top-down : contexte, structure, déclencheur.",
    icon: '🔭',
    level: 'Intermédiaire',
    lessons: MTF,
  },
  // ── Lecture avancée du marché ──
  {
    id: 'smc',
    title: 'Smart Money & liquidité',
    tagline: 'BOS/CHoCH, order blocks, liquidité & stop hunts.',
    icon: '🐋',
    level: 'Avancé',
    lessons: SMC,
  },
  {
    id: 'wyckoff',
    title: 'Méthode Wyckoff',
    tagline: 'Accumulation, distribution, springs & Volume Profile.',
    icon: '🏛️',
    level: 'Avancé',
    lessons: WYCKOFF,
  },
  {
    id: 'derives',
    title: 'Dérivés & sentiment',
    tagline: 'Funding, open interest, basis & squeezes de levier.',
    icon: '💸',
    level: 'Avancé',
    lessons: DERIVES,
  },
  {
    id: 'orderflow',
    title: 'Order flow & carnet',
    tagline: 'Carnet, imbalance, CVD, absorption & liquidations.',
    icon: '🌊',
    level: 'Avancé',
    lessons: ORDERFLOW,
  },
  // ── Le mental ──
  {
    id: 'psycho',
    title: 'Psychologie & discipline',
    tagline: 'Le mental : FOMO, plan, journal et patience.',
    icon: '🧠',
    level: 'Transversal',
    lessons: PSYCHO,
  },
]

export const MODULE_MAP: Record<string, Module> = Object.fromEntries(
  MODULES.map((m) => [m.id, m]),
)

export interface Phase {
  /** Stage title shown above its module group. */
  title: string
  /** One-line framing of what this stage teaches. */
  hint: string
  /** Module ids, in learning order, belonging to this stage. */
  moduleIds: string[]
}

/**
 * The pedagogical path: modules grouped into ordered stages, from foundations
 * to advanced market reading, with psychology as a transversal capstone.
 * Drives the order AND grouping shown in the module picker.
 */
export const PHASES: Phase[] = [
  {
    title: 'Fondations',
    hint: 'Lire le prix et démarrer sur des bases saines.',
    moduleIds: ['essentiel', 'chandeliers'],
  },
  {
    title: 'Boîte à outils technique',
    hint: 'Maîtriser les indicateurs, les figures et la méthode.',
    moduleIds: ['indicateurs', 'figures', 'fibonacci', 'mtf'],
  },
  {
    title: 'Lecture avancée du marché',
    hint: 'Smart money, volume, dérivés et order flow.',
    moduleIds: ['smc', 'wyckoff', 'derives', 'orderflow'],
  },
  {
    title: 'Le mental',
    hint: 'La compétence transversale, à cultiver en continu.',
    moduleIds: ['psycho'],
  },
]

/** Flat list of the essential track — kept for any legacy import. */
export const LESSONS: Lesson[] = ESSENTIEL
