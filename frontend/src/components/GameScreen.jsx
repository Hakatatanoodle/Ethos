import { useEffect, useMemo, useState } from 'react'
import { buildScenes, projectPlayback } from './gamePlayback.js'

export default function GameScreen({ snap, events, conn, onExit }) {
  const [count, setCount] = useState(0)
  const [intro, setIntro] = useState(true)
  const [paused, setPaused] = useState(false)
  const [pace, setPace] = useState(1)
  const scenes = useMemo(() => buildScenes(events), [events])
  const view = useMemo(() => projectPlayback(snap.config, scenes, count), [snap.config, scenes, count])
  const scene = count ? scenes[count - 1] : null
  const p = scene?.payload || {}
  const player = view.players.find(x => x.config.id === p.player_id)
  const winner = view.players.find(x => x.config.id === p.winner_id)
  const finished = scene?.type === 'game_ended'
  const waiting = !intro && count === scenes.length && !finished
  const rules = events.filter(e => e.type === 'rule_injected' && e.payload.round === 0)

  useEffect(() => {
    if (paused || finished) return
    // Do not start the public first round until all first-round moves are ready.
    if (intro) {
      if (!scenes.length) return
      const timer = setTimeout(() => { setIntro(false); setCount(1) }, 12000 / pace)
      return () => clearTimeout(timer)
    }
    if (count >= scenes.length) return
    const duration = scene?.type === 'rule_injected' ? 8000 : scene?.type === 'round_resolved' ? 6000 : 3500
    const timer = setTimeout(() => setCount(n => n + 1), duration / pace)
    return () => clearTimeout(timer)
  }, [intro, count, scenes.length, paused, pace, finished, scene?.type])

  const next = () => {
    if (!scenes.length) return
    setIntro(false)
    setCount(n => Math.min(n + 1, scenes.length))
  }
  const type = scene?.type
  return <div className="broadcast">
    <div className="broadcast-bar">
      <span className="broadcast-label">♠ ETHOS / GAME SCREEN</span>
      <span className="muted">{intro ? 'Opening announcement' : `Round ${view.round}`} · {snap.config.mode}</span>
      <span className={`pill ${conn}`}>{conn === 'live' ? '● Connected' : conn}</span>
    </div>
    <section className="game-stage" aria-live="polite" aria-atomic="true">
      <div className="stage-orbit" aria-hidden="true" />
      {intro ? <div className="stage-content intro-content">
        <span className="stage-eyebrow">THE GAME MASTER PRESENTS</span>
        <h2>The Beauty<br /><em>Contest.</em></h2>
        <p className="stage-subtitle">Don’t guess the number. Guess each other.</p>
        <div className="intro-rules">
          <div><b>01 / CHOOSE</b><p>Each player secretly chooses an integer from {snap.config.guess_min} to {snap.config.guess_max}.</p></div>
          <div><b>02 / ANTICIPATE</b><p>The target is {snap.config.factor} × the average of all guesses. Distance from it adds to your penalty.</p></div>
          <div><b>03 / SURVIVE</b><p>Lowest total penalty wins. {snap.config.mode === 'elimination' ? `The highest total is eliminated every ${snap.config.eliminate_every} round(s).` : `Play lasts ${snap.config.rounds} rounds.`}</p></div>
        </div>
        <details className="opening-rulebook"><summary>Full opening rulebook</summary>{rules.map(e => <p key={e.seq}><strong>{e.payload.rule.title}</strong> — {e.payload.rule.description}</p>)}</details>
        <p className="preparation">{scenes.length ? 'All first-round answers are locked. The show is ready.' : 'Players receive the rules and prepare privately. Waiting for all answers…'}</p>
      </div> : <div className="stage-content" key={scene?.seq}>
        <span className="stage-eyebrow">{type === 'player_acted' ? `ROUND ${view.round} / THE FLOOR IS YOURS` : 'THE GAME MASTER'}</span>
        {type === 'round_started' && <><h2>Round <em>{view.round.toString().padStart(2, '0')}</em></h2><p className="stage-subtitle">{p.special ? 'Sudden death. Only 0 or 100.' : 'Answers are locked. Let’s hear from the players.'}</p></>}
        {type === 'player_acted' && <><div className="speaker-avatar">{player?.config.name.slice(0, 2).toUpperCase()}</div><h3 className="speaker-name">{player?.config.name}</h3><p className="stage-subtitle">{p.fallback ? 'Referee-assigned answer' : 'My answer is'}</p><div className="answer-number">{String(p.action)}</div>{p.fallback && <p className="muted">No valid response · default move with a violation penalty</p>}</>}
        {type === 'round_resolved' && <><h2>The target is <em>{Number(p.target).toFixed(2)}</em></h2><p className="stage-subtitle">Round {view.round} complete. Penalties are now on the board.</p><div className="result-chips">{Object.entries(p.deltas).map(([id, d]) => <div key={id}><span>{view.players.find(x => x.config.id === id)?.config.name}</span><b>{d.delta >= 0 ? '+' : ''}{Number(d.delta).toFixed(1)}</b></div>)}</div></>}
        {type === 'rule_injected' && <><span className="rule-symbol">⚠</span><h2 className="rule-title">{p.rule.title.replace('DYNAMIC RULE INJECTED — ', '')}</h2><p className="stage-subtitle">{p.rule.description}</p></>}
        {type === 'player_eliminated' && <><span className="stage-eyebrow">ELIMINATED</span><h2>{player?.config.name}</h2><p className="stage-subtitle">Their run ends here. The remaining players move on.</p></>}
        {finished && <><span className="rule-symbol">♛</span><span className="stage-eyebrow">THE LAST WORD</span><h2><em>{winner?.config.name || 'Match complete'}</em>{winner && ' wins.'}</h2><p className="stage-subtitle">{p.reason}{winner && ` · Final penalty ${winner.score.toFixed(1)}`}</p><button className="primary" onClick={onExit}>Back to lobby</button></>}
      </div>}
      {waiting && <div className="stage-wait">{conn !== 'live' ? 'Reconnecting to the arena…' : snap.status === 'paused' ? 'Engine paused. Resume it in Live Logs.' : 'The next round is being prepared privately…'}</div>}
    </section>
    <div className="contestant-row">{view.players.map((x, i) => <div key={x.config.id} className={`contestant ${player?.config.id === x.config.id && type === 'player_acted' ? 'speaking' : ''} ${x.status}`} style={{ '--player-color': ['#53ded1', '#b09aff', '#f5bf77', '#77adff', '#fa83aa'][i % 5] }}>
      <div className="contestant-top"><span className="contestant-initial">{x.config.name.slice(0, 2).toUpperCase()}</span><span>{x.config.name}<small>{x.status === 'eliminated' ? 'ELIMINATED' : intro ? 'IN THE ARENA' : x.action !== null ? 'REVEALED' : 'ANSWER SEALED'}</small></span></div>
      <div className="contestant-score"><strong>{x.action === null ? '—' : String(x.action)}</strong><span>{x.score.toFixed(1)}<small>TOTAL PENALTY</small></span></div>
    </div>)}</div>
    <div className="playback-controls"><div><button onClick={() => setPaused(x => !x)}>{paused ? '▶ Play' : 'Ⅱ Pause'} show</button><button onClick={next} disabled={finished || count >= scenes.length}>Next reveal →</button><button className="ghost" onClick={() => { setCount(0); setIntro(true); setPaused(false) }}>↺ Replay</button></div><label>Playback <select value={pace} onChange={e => setPace(Number(e.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label><span className="muted">Public answers only · computation continues in the background</span></div>
  </div>
}
