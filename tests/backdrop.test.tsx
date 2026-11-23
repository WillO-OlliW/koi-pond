import { expect, test } from 'claude-code/testing'

const BACKDROP = {
  plugin: 'koi-pond',
  component: 'Backdrop',
  props: { scene: 'koi-pond', plugin: 'koi-pond', glass: { blur: 16, opacity: 0.6 } },
} as const

const START = { text: 'hello', turnId: 't1' }
const DONE = { answer: 'hi', durationMs: 1200, isAborted: false, turnId: 't1', reason: 'answer' } as const

test('the GPU pond plays over the still pond on desktop and mobile', async $ => {
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BACKDROP, surface })
    const shader = await ui.find({ type: 'Shader' })

    expect(shader?.props.module).toBe('hooks/pond.ts')
    expect(await ui.find({ type: 'Svg' })).toBeDefined()
    await ui.unmount()
  }
})

test('the koi hear each message sent and Claude at work', async ($, on) => {
  // The engine's own answers, beneath the mod.
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))

  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop' })

  expect((await ui.find({ type: 'Shader' }))?.props.values).toEqual({ busy: 0, sends: 0 })

  await $.prompt.submit({ text: 'hello', wait: false, origin: { kind: 'composer' } })
  await $.turn.start(START)
  expect((await ui.find({ type: 'Shader' }))?.props.values).toEqual({ busy: 1, sends: 1 })

  await $.turn.start({ ...START, turnId: 't2', agentId: 'helper' })
  await $.turn.complete({ ...DONE, turnId: 't2', agentId: 'helper' })
  expect((await ui.find({ type: 'Shader' }))?.props.values).toEqual({ busy: 1, sends: 1 })

  await $.turn.complete(DONE)
  expect((await ui.find({ type: 'Shader' }))?.props.values).toEqual({ busy: 0, sends: 1 })
  await ui.unmount()
})

test('another scene is left alone', async $ => {
  const ui = await $.ui.mount({ ...BACKDROP, surface: 'desktop', props: { ...BACKDROP.props, scene: 'other' } })

  expect(await ui.find({ type: 'Shader' })).toBeUndefined()
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()
})
