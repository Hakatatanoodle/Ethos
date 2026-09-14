import test from 'node:test'
import assert from 'node:assert/strict'
import { buildScenes, projectPlayback } from './gamePlayback.js'

const config = { players: [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }] }
const event = (type, payload, seq) => ({ type, payload, seq })
const events = [
  event('rule_injected', { round: 0, rule: { id: 'core' } }, 0),
  event('round_started', { round: 1 }, 1),
  event('player_thinking', { player_id: 'a' }, 2),
  event('player_acted', { round: 1, player_id: 'b', action: 30, reasoning: 'SECRET', error: 'PRIVATE' }, 3),
  event('player_acted', { round: 1, player_id: 'a', action: 10 }, 4),
  event('round_resolved', { round: 1, target: 16, deltas: { a: { delta: 6 }, b: { delta: 14 } } }, 5),
  event('player_eliminated', { round: 1, player_id: 'b' }, 6),
  event('game_ended', { winner_id: 'a' }, 7),
]

test('buffers a round until all answers are ready and scoring has completed', () => {
  assert.deepEqual(buildScenes(events.slice(0, 5)), [])
  assert.equal(buildScenes(events).length, 6)
})
test('never includes private reasoning, thinking events, or raw errors', () => {
  const scenes = buildScenes(events)
  assert.ok(!JSON.stringify(scenes).includes('SECRET'))
  assert.ok(!JSON.stringify(scenes).includes('PRIVATE'))
  assert.ok(!scenes.some(e => e.type === 'player_thinking'))
})
test('reveals simultaneous answers separately without leaking scores or eliminations', () => {
  const scenes = buildScenes(events)
  const first = projectPlayback(config, scenes, 2)
  assert.equal(first.players[0].action, null)
  assert.equal(first.players[1].action, 30)
  assert.deepEqual(first.players.map(p => p.score), [0, 0])
  assert.equal(first.target, null)
  const results = projectPlayback(config, scenes, 4)
  assert.deepEqual(results.players.map(p => p.score), [6, 14])
  assert.equal(results.target, 16)
  assert.equal(results.players[1].status, 'alive')
  assert.equal(projectPlayback(config, scenes, 5).players[1].status, 'eliminated')
})
test('replay resets scores, answers and eliminations; new rounds clear answers only', () => {
  const scenes = buildScenes(events)
  const replay = projectPlayback(config, scenes, 0)
  assert.deepEqual(replay.players.map(p => [p.score, p.action, p.status]), [[0, null, 'alive'], [0, null, 'alive']])
  const next = projectPlayback(config, [...scenes.slice(0, 4), event('round_started', { round: 2 }, 8)], 5)
  assert.equal(next.round, 2)
  assert.deepEqual(next.players.map(p => p.action), [null, null])
  assert.deepEqual(next.players.map(p => p.score), [6, 14])
})
