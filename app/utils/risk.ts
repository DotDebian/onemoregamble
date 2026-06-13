// Position sizing / risk math (pure).

export interface RiskInput {
  accountSize: number
  riskPct: number
  entry: number
  stop: number
  target?: number | null
}

export interface RiskResult {
  valid: boolean
  direction: 'long' | 'short'
  riskAmount: number
  perUnitRisk: number
  quantity: number
  notional: number
  rr: number | null
  reward: number | null
}

export function computeRisk(input: RiskInput): RiskResult {
  const { accountSize, riskPct, entry, stop, target } = input
  const perUnitRisk = Math.abs(entry - stop)
  const riskAmount = (accountSize * riskPct) / 100
  const valid = accountSize > 0 && riskPct > 0 && entry > 0 && perUnitRisk > 0
  const quantity = valid ? riskAmount / perUnitRisk : 0
  const direction: 'long' | 'short' = entry >= stop ? 'long' : 'short'
  let rr: number | null = null
  let reward: number | null = null
  if (valid && target != null && target > 0) {
    rr = Math.abs(target - entry) / perUnitRisk
    reward = quantity * Math.abs(target - entry)
  }
  return {
    valid,
    direction,
    riskAmount,
    perUnitRisk,
    quantity,
    notional: quantity * entry,
    rr,
    reward,
  }
}
