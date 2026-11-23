import type { Register, ThemeSetArgs, ThemeSound, ThemeStyle } from 'claude-code'

import { makeColors } from './make-colors.js'
import { SCENE } from './scene.js'

// Koi Pond: a deep indigo pond by night, paper cards over a sunlit jade pond by day.
// Koi orange leads; lily-pad green, gold and pond teal keep code readable.
const { theme, problems } = makeColors({
  label: 'Koi Pond',
  roles: { accent: '#e8642a', danger: '#c4352b', success: '#4f8a5b', warning: '#c58f22', pro: '#3e8aa3' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#f1e8d9',
        'surface-1': '#f6efe3',
        'surface-2': '#fbf7ef',
        'surface-3': '#fbf7ef',
        'text-primary': '#2b211a',
        'text-secondary': '#54463a',
        'text-muted': '#6b5c4e',
      },
    },
  },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#0b1424',
        'surface-1': '#101b2f',
        'surface-2': '#142238',
        'surface-3': '#18273f',
        'text-primary': '#f4f0ea',
        'text-secondary': '#cfcad8',
        'text-muted': '#a3a0b4',
      },
    },
  },
})

// The person's own messages sit in a warm koi-orange bubble.
const colors = {
  ...theme,
  inputs: {
    light: { ...theme.inputs.light, 'bg-user-message': '#fbe3cf', 'text-user-message': '#2b211a' },
    dark: { ...theme.inputs.dark, 'bg-user-message': '#3a2318', 'text-user-message': '#f8ede2' },
  },
} as const

// Replies and tool rows float on the pond as paper cards, so swimming koi never
// sit right behind the words.
const STYLE: ThemeStyle = {
  UserMessage: {
    backgroundColor: 'bg-user-message',
    color: 'text-user-message',
    borderColor: '#e8642a55',
    borderWidth: 1,
    radius: [16, 16, 4, 16],
    paddingX: 14,
    paddingY: 10,
  },
  AssistantMessage: {
    backgroundColor: 'surface-1',
    radius: 14,
    paddingX: 16,
    paddingY: 12,
    shadow: { x: 0, y: 2, blur: 10, color: '#00000022' },
  },
  ToolUse: { backgroundColor: 'surface-1', radius: 10, paddingX: 10 },
}

// Water under a quiet garden: a low current, now and then a drop or a chime.
const SOUND: ThemeSound = {
  ambience: {
    layers: [
      { wave: 'brown', drone: true, gain: 0.22, filter: { type: 'lowpass', hz: 420, to: 700 } },
      { wave: 'crackle', scatter: 0.6, gain: 0.05, release: 0.2, filter: { type: 'bandpass', hz: 2400 } },
      { wave: 'sine', notes: ['A5', 'C6', 'D6', 'E6'], scatter: 0.12, glide: -9, attack: 0.004, release: 0.22, gain: 0.07 },
      { wave: 'bell', notes: ['D5', 'E5', 'G5', 'A5', 'B5'], scatter: 0.04, release: 2.4, gain: 0.05 },
    ],
    reverb: 0.45,
  },
  cues: {
    send: { layers: [{ wave: 'sine', notes: ['E6'], glide: -10, release: 0.25, gain: 0.25 }], reverb: 0.3 },
    done: { layers: [{ wave: 'bell', notes: ['D5', 'G5', 'B5'], step: 0.12, release: 1.6, gain: 0.22 }], reverb: 0.4 },
    ask: { layers: [{ wave: 'bell', notes: ['E5', 'A5'], step: 0.16, release: 1.2, gain: 0.22 }], reverb: 0.35 },
    error: { layers: [{ wave: 'triangle', notes: ['A3', 'F3'], step: 0.18, release: 0.6, gain: 0.2 }] },
    click: {
      layers: [{ wave: 'sine', notes: ['D5', 'E5', 'G5', 'A5', 'B5', 'D6'], glide: -12, release: 0.3, gain: 0.25 }],
      reverb: 0.35,
    },
  },
}

// Panels over the pond are tinted but not blurred: a blur would be redone on every
// frame of the swimming koi.
const BACKDROP = { scene: 'koi-pond', glass: { blur: 0, opacity: 0.85 } } as const

const LOOK: ThemeSetArgs = { colors, backdrop: BACKDROP, sound: SOUND, style: STYLE }

// What the pond hears from the session: Claude at work (the koi circle), and each
// message sent (a drop falls from the message box). The shader eases between values.
let busy = 0
let sends = 0

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    // Older builds refuse `sound` or `style`; fall back to the colors and pond alone.
    let set
    try {
      set = await $.theme.set(LOOK)
    } catch (error) {
      $.ui.log(`koi-pond: ${String(error)}`)
      set = await $.theme.set({ colors, backdrop: BACKDROP })
    }

    if (!set.isDrawn) {
      $.ui.status(set.reason)
    }

    return next(e)
  })

  // Only the person's own messages drop into the pond, typed here or sent from a phone.
  on('prompt.submit', ($, e, next) => {
    if (e.origin.kind === 'composer' || e.origin.kind === 'bridge') {
      sends = (sends + 1) % 1024
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    if (e.agentId === undefined) {
      busy = 1
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  on('turn.complete', ($, e, next) => {
    if (e.agentId === undefined) {
      busy = 0
      $.ui.invalidate('ui.render')
    }

    return next(e)
  })

  // On the desktop the pond plays on the GPU; phones, Reduce Motion and a GPU that
  // can't keep up show the still SVG pond instead.
  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== BACKDROP.scene) {
      return next(e)
    }

    const { Shader, Svg } = $.ui.resolve(e)

    return (
      <Shader module="./pond.ts" values={{ busy, sends }}>
        <Svg source={SCENE} alt="Looking down into a pond where ASCII koi of many colors swim, gather at food and circle while Claude works" isInteractive />
      </Shader>
    )
  })
}
