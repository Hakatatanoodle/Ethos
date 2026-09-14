// A public, spoiler-free projection. Never copy reasoning or live snapshot scores.
export function buildScenes(events) {
  const resolved = new Set(events.filter(e => e.type === 'round_resolved').map(e => e.payload.round))
  const scenes = []
  for (const e of events) {
    const p = e.payload
    if (e.type === 'round_started' && !resolved.has(p.round)) break
    if (e.type === 'rule_injected' && p.round === 0) continue
    if (['round_started', 'player_acted', 'round_resolved', 'player_eliminated', 'game_ended', 'rule_injected'].includes(e.type)) {
      // Explicit allowlist keeps private model output out of playback state.
      const { round, player_id, action, fallback, target, deltas, winner_id, reason, rule, special } = p
      scenes.push({ seq: e.seq, type: e.type, payload: { round, player_id, action, fallback, target, deltas, winner_id, reason, rule, special } })
    }
  }
  return scenes
}

export function projectPlayback(config, scenes, count) {
  const players = Object.fromEntries(config.players.map(config => [config.id, { config, score: 0, status: 'alive', action: null }]))
  let round = 0
  let target = null
  for (const e of scenes.slice(0, count)) {
    const p = e.payload
    if (e.type === 'round_started') {
      round = p.round
      target = null
      Object.values(players).forEach(player => { player.action = null })
    }
    if (e.type === 'player_acted' && players[p.player_id]) players[p.player_id].action = p.action
    if (e.type === 'round_resolved') {
      target = p.target
      Object.entries(p.deltas).forEach(([id, d]) => { players[id].score += d.delta })
    }
    if (e.type === 'player_eliminated') players[p.player_id].status = 'eliminated'
  }
  return { players: Object.values(players), round, target }
}
