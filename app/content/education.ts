// Beginner-friendly explanations for every indicator / overlay.
// `short` is the hover tooltip ("what appears on the chart"); the rest feeds the
// detail modal. Grounded in standard definitions (Investopedia / Babypips) but
// written from scratch in plain French.

export interface IndicatorEdu {
  name: string
  /** 1 short sentence — shown on hover. Describes what appears on the chart. */
  short: string
  /** What it is. */
  what: string
  /** How to read it on the chart. */
  read: string
  /** Key signals / how a trader uses it. */
  signals: string[]
  /** One beginner caution/tip. */
  tip?: string
}

export const EDUCATION: Record<string, IndicatorEdu> = {
  ema: {
    name: 'EMA — Moyennes mobiles exponentielles',
    short: 'Trois courbes lissées (9 / 21 / 50) qui suivent le prix et révèlent la tendance.',
    what: "Une moyenne mobile exponentielle lisse le prix en donnant plus de poids aux bougies récentes. On en affiche trois (9, 21, 50) pour lire la tendance à court, moyen et plus long terme.",
    read: "Quand les courbes sont empilées et orientées dans le même sens (9 au-dessus de 21 au-dessus de 50), la tendance est haussière ; l'inverse pour une tendance baissière. Les EMA agissent souvent comme support/résistance « dynamiques » : le prix vient les retoucher puis repart.",
    signals: [
      'Empilement 9>21>50 = biais haussier ; 9<21<50 = biais baissier.',
      "Croisement de l'EMA 9 au-dessus de l'EMA 21 = signal de momentum haussier (et inversement).",
      "Le prix qui rebondit sur l'EMA 21/50 en tendance = zone d'entrée classique.",
    ],
    tip: "Ne trade pas contre l'empilement des EMA : en tendance claire, privilégie les entrées dans le sens des moyennes.",
  },
  sma: {
    name: 'SMA 200 — Moyenne mobile simple',
    short: 'Une courbe de fond (200 périodes) qui marque la tendance long terme.',
    what: "La moyenne mobile simple sur 200 périodes est la référence de tendance de fond la plus suivie au monde.",
    read: "Prix au-dessus de la SMA 200 = contexte globalement haussier ; en dessous = contexte baissier. Sa pente indique la direction de fond.",
    signals: [
      'Prix > SMA 200 : on cherche surtout des achats.',
      'Prix < SMA 200 : on cherche surtout des ventes/prudence.',
      'La SMA 200 sert souvent de gros support/résistance.',
    ],
    tip: "C'est un filtre de contexte, pas un signal d'entrée à elle seule.",
  },
  bollinger: {
    name: 'Bandes de Bollinger',
    short: "Trois lignes (moyenne ± 2 écarts-types) formant un canal de volatilité autour du prix.",
    what: "Une moyenne 20 périodes encadrée de deux bandes situées à 2 écarts-types. L'écartement des bandes mesure la volatilité.",
    read: "Bandes serrées = faible volatilité (souvent avant un gros mouvement, le « squeeze »). Bandes larges = forte volatilité. Le prix passe ~95% du temps entre les bandes.",
    signals: [
      'Squeeze (bandes serrées) = compression, un mouvement se prépare.',
      'Touche de la bande haute/basse = prix étiré (pas un signal de vente/achat à lui seul).',
      "%B indique où est le prix dans le canal (1 = bande haute, 0 = bande basse).",
    ],
    tip: "Une touche de bande n'est pas un signal de retournement : en tendance forte, le prix « marche » le long d'une bande.",
  },
  vwap: {
    name: 'VWAP — Prix moyen pondéré par le volume',
    short: 'Une ligne du « prix juste » de la journée, pondéré par les volumes (remise à zéro chaque jour UTC).',
    what: "Le VWAP est la moyenne des prix pondérée par le volume échangé depuis le début de la journée. C'est la référence des institutionnels.",
    read: "Prix au-dessus du VWAP = acheteurs en contrôle sur la journée ; en dessous = vendeurs. Le prix a tendance à revenir vers le VWAP (aimant de moyenne).",
    signals: [
      'Au-dessus du VWAP : biais intraday haussier.',
      'Rejet/rebond sur le VWAP = zone de décision fréquente.',
      'Éloignement extrême du VWAP = mouvement potentiellement étiré.',
    ],
    tip: 'Très utile en intraday ; perd de son sens sur les grandes unités de temps.',
  },
  vwapBands: {
    name: 'Bandes du VWAP (±1σ / ±2σ)',
    short: "Des bandes d'écart-type autour du VWAP qui marquent les zones de sur-extension.",
    what: "Des enveloppes situées à 1 et 2 écarts-types autour du VWAP, pondérées par le volume.",
    read: "Plus le prix s'éloigne du VWAP vers ±2σ, plus il est étiré et susceptible de revenir vers la moyenne.",
    signals: [
      '±1σ : fonctionnement « normal ».',
      '±2σ : zone de sur-extension, retour vers le VWAP plus probable.',
    ],
    tip: 'À combiner avec un signal de retournement, pas à trader seul.',
  },
  rsi: {
    name: 'RSI — Indice de force relative',
    short: 'Un oscillateur 0–100 (pane du bas) qui mesure le momentum : surachat/survente.',
    what: "Le RSI (14) compare l'ampleur des hausses et des baisses récentes pour donner un score de momentum entre 0 et 100.",
    read: "Au-dessus de 70 = surachat (mouvement haussier mûr) ; sous 30 = survente. La ligne 50 sépare le biais haussier du baissier ; dans la stratégie EMA+RSI, on utilise 55 (haussier) et 45 (baissier).",
    signals: [
      'RSI > 70 : surachat — prudence sur les achats.',
      'RSI < 30 : survente — prudence sur les ventes.',
      "Divergence (prix fait un plus-haut, RSI un plus-bas) = essoufflement possible.",
    ],
    tip: "En forte tendance, le RSI peut rester en surachat/survente longtemps : ce n'est pas un ordre de vendre/acheter.",
  },
  macd: {
    name: 'MACD — Convergence/divergence des moyennes',
    short: 'Deux lignes + un histogramme (pane du bas) montrant tendance et momentum.',
    what: "Le MACD (12, 26, 9) est la différence entre deux EMA, accompagnée d'une ligne de signal et d'un histogramme de leur écart.",
    read: "Histogramme positif = momentum haussier, négatif = baissier. Le croisement de la ligne MACD au-dessus de sa ligne de signal est un signal haussier.",
    signals: [
      'Croisement MACD > signal = momentum haussier (et inversement).',
      'Passage de la ligne MACD au-dessus de 0 = renforcement haussier.',
      "Divergence avec le prix = retournement possible.",
    ],
    tip: 'Indicateur retardé : il confirme un mouvement, il ne le devance pas.',
  },
  atr: {
    name: 'ATR — Average True Range',
    short: 'Une mesure de volatilité (en $) — utile pour placer ton stop, pas pour la direction.',
    what: "L'ATR (14) mesure l'amplitude moyenne des bougies : la « respiration » du marché.",
    read: "ATR élevé = grandes bougies, marché agité ; ATR faible = calme. La valeur est en dollars (et en % du prix).",
    signals: [
      'Dimensionne ton stop : ex. stop = entrée − 1,5 × ATR.',
      "ATR qui grimpe = volatilité en hausse (élargis tes stops).",
    ],
    tip: "L'ATR ne donne aucune direction : c'est un outil de gestion du risque.",
  },
  volume: {
    name: 'Volume',
    short: 'Des barres (pane du bas) montrant la quantité échangée par bougie + sa moyenne.',
    what: "Le volume est la quantité d'actif échangée sur chaque bougie. Vert = bougie haussière, rouge = baissière.",
    read: "Un mouvement accompagné d'un volume supérieur à la moyenne (ligne) est plus « crédible ». Une cassure sans volume est suspecte.",
    signals: [
      'Volume au-dessus de la moyenne = conviction derrière le mouvement.',
      'Pic de volume sur un retournement = capitulation/épuisement possible.',
      'Cassure de niveau avec gros volume = plus fiable.',
    ],
    tip: 'Le volume confirme ; il ne prédit pas le sens à lui seul.',
  },
  pivots: {
    name: 'Points pivots (journaliers)',
    short: "Sept niveaux horizontaux (PP, R1–R3, S1–S3) calculés sur la veille.",
    what: "Des niveaux de référence calculés à partir du haut/bas/clôture de la veille : un pivot central (PP) et trois résistances/supports.",
    read: "Le prix réagit souvent à ces niveaux. Au-dessus du PP = biais haussier de la séance ; en dessous = baissier.",
    signals: [
      'PP = pivot central de la journée (biais).',
      'R1/R2/R3 = résistances ; S1/S2/S3 = supports.',
      'Cassure franche d\'un niveau = objectif vers le niveau suivant.',
    ],
    tip: 'Très utilisés en intraday comme objectifs et zones de réaction.',
  },
  autosr: {
    name: 'Support / Résistance automatiques',
    short: 'Des lignes horizontales détectées sur les sommets/creux, avec leur force (nb de touches).',
    what: "L'outil repère les sommets et creux marquants (swings) et les regroupe en zones de support/résistance, classées par nombre de touches.",
    read: "Plus une ligne a été touchée (·2, ·3, ·4), plus elle est solide. Rouge = au-dessus du prix (résistance), vert = en dessous (support).",
    signals: [
      'Rebond sur un niveau = zone d\'entrée/sortie.',
      'Cassure + retest réussi = continuation.',
      'Plus de touches = niveau plus fiable.',
    ],
    tip: 'Traite ces lignes comme des zones, pas des prix exacts au centime.',
  },
  structure: {
    name: 'Structure de marché (HH/HL)',
    short: "Des marqueurs sur les sommets/creux (HH, HL, LH, LL) qui révèlent la tendance.",
    what: "La structure étiquette chaque sommet/creux : Higher High (HH), Higher Low (HL), Lower High (LH), Lower Low (LL).",
    read: "Une succession de HH + HL = tendance haussière. Une succession de LH + LL = tendance baissière. Un changement (ex. premier LL en tendance haussière) = cassure de structure.",
    signals: [
      'HH + HL = tendance haussière saine.',
      'LH + LL = tendance baissière.',
      'Cassure de structure (BOS) = retournement potentiel.',
    ],
    tip: 'La structure est la base de la lecture de tendance, avant tout indicateur.',
  },
  sessions: {
    name: 'Sessions de marché',
    short: 'Des bandes de fond colorées : Asie, Londres et New York (US).',
    what: "Le fond du graphe est teinté selon la session active : Asie, Europe (Londres) et US (New York).",
    read: "La volatilité et le volume changent fortement selon la session. Le chevauchement Londres ↔ New York (≈ 13–16h UTC) est la période la plus active.",
    signals: [
      'Ouverture US = souvent un pic de volatilité.',
      'Chevauchement Londres/NY = mouvements les plus amples.',
      'Session asiatique = souvent plus calme (ranges).',
    ],
    tip: 'Adapte ton style à la session : range en Asie, momentum à l\'ouverture US.',
  },
  volumeProfile: {
    name: 'Volume Profile',
    short: "Un histogramme horizontal (à droite) du volume échangé par niveau de prix, avec le POC.",
    what: "Au lieu du volume par temps, le Volume Profile montre le volume par prix sur la zone visible. Le POC (ligne dorée) est le prix le plus échangé.",
    read: "Les zones épaisses (Value Area, en bleu) = prix très échangés, qui agissent comme aimants/zones d'équilibre. Les zones fines = peu de volume, le prix les traverse vite.",
    signals: [
      'POC = aimant à prix et support/résistance majeur.',
      'Value Area = zone de « juste prix » (≈ 70% du volume).',
      'Zones de faible volume = traversées rapides (mouvements).',
    ],
    tip: 'Le POC est l\'un des niveaux les plus respectés du marché.',
  },
  liquidations: {
    name: 'Liquidations (heatmap)',
    short: 'Une heatmap des zones de liquidation + des bulles des liquidations réelles (rouge = longs, vert = shorts).',
    what: "Deux choses : (1) une heatmap ESTIMÉE (modèle de paliers de levier) montrant où des positions seraient liquidées — pas la donnée de l'exchange ; (2) les liquidations RÉELLES en direct (futures), en bulles dont la taille = montant.",
    read: "Les bandes chaudes (ambre) = gros clusters de liquidations potentielles, qui agissent comme des aimants à prix. Les bulles rouges = des longs ont été liquidés (vente forcée) ; vertes = des shorts. Les bulles à halo doré = « whales » (≥ 100 000 $).",
    signals: [
      'Gros cluster estimé = zone que le prix a tendance à venir « chercher ».',
      'Cascade de bulles rouges = purge des longs (creux possible).',
      'Cascade de bulles vertes = purge des shorts (sommet possible).',
    ],
    tip: 'La heatmap est une estimation par modèle de levier, pas la position réelle de l\'exchange : un repère, pas une vérité.',
  },
}
