# Koi Pond

A theme for the Claude desktop and mobile apps. You look down into a pond where ASCII koi swim behind the conversation.

- **A living pond:** on the desktop, the pond runs on your graphics card and is redrawn as characters every frame. Six koi steer for themselves: they wander, bank through turns, beat their tails and give each other room.
- **Feeding:** click the water and a ring opens where you clicked. A few pellets float there, and nearby koi swim over to eat them.
- **Your cursor** leaves a thin wake on the water.
- **Claude:** each message you send drops into the pond from the message box. While Claude works, the koi circle the conversation, and when it finishes they scatter.
- **Varieties:**
  - kohaku (white and orange-red)
  - sanke
  - tancho
  - gold yamabuki
  - orange orenji
  - blue asagi
- **Dark mode:** a deep indigo pond with moonlit glints.
- **Light mode:** sunlit jade water, with light shimmering on the bottom and soft shadows under the koi.
- **Colors:** koi orange is the accent. Lily-pad green, gold and pond teal keep code easy to read.
- **Messages:** your messages sit in a soft orange bubble. Replies and tool rows sit on paper cards, so the koi never swim right behind the words.
- **Sound (optional):** press the speaker in the session's title bar to hear quiet water, an occasional drop or chime, and soft cues when Claude finishes or asks something.

On a phone, with Reduce Motion on, or on a graphics card that can't keep up, you see a still pond instead.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install koi-pond --marketplace WillO-OlliW/koi-pond
```

Answer `y` to add the marketplace, then pick a scope (the user scope is first; press Enter).

From a shell:

```
claude plugin install koi-pond --marketplace WillO-OlliW/koi-pond
```

In the desktop app, where `/plugin` doesn't run: click **+** next to the prompt box, then **Plugins**, then **Add marketplace** with `WillO-OlliW/koi-pond`, then **Add plugin**.

## Changing it

- `hooks/pond.ts` is the moving pond:
  - `KOI` sets each koi's size, speed, depth and color.
  - `PATCH` sets the markings.
  - `PADS` places the lily pads.
- `hooks/scene.js` is the still pond.
