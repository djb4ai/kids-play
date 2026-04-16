# Phase 1 Spec — Simple Game Generation MVP

## Title
Adaptive Play — Phase 1: Select a Skill and Generate a Game

## Goal
Build the simplest playable version of the product:
- a child chooses what they want to practice
- the system generates a simple game from a reusable template
- the child plays the game and gets short, affirmative feedback

This phase is about proving that **Codex can generate a personalized game variant quickly**, without trying to create a brand new game from scratch every time.

## Why this phase matters
For a hackathon, the biggest risk is complexity. Phase 1 keeps the product focused and demoable:
- one entry screen
- three skill areas
- template-based generation
- short game sessions
- positive kid-friendly feedback

## Supported practice areas
The first version supports:
- **Reading**
- **Memory**
- **Attention**

## Product experience
### Child flow
1. Open the platform.
2. See a simple prompt: **"What do you want to practice today?"**
3. Choose one of three options:
   - Reading
   - Memory
   - Attention
4. The platform sends the selected skill to the Codex generation service.
5. Codex chooses a game template and fills it with content for that skill.
6. The game launches in a separate runtime.
7. The child plays for a short session.
8. The game gives short positive feedback such as:
   - "Great job!"
   - "Nice try!"
   - "Let's do one more!"
9. The session ends with a simple completion message.

## Scope
### In scope
- one child selection screen
- three practice categories
- one simple game template per category
- Codex-generated game content inside templates
- short, repeatable game sessions
- child-friendly affirmative feedback
- game runtime separated from app-server

### Out of scope
- long-term progress tracking
- adaptive difficulty based on previous sessions
- parent dashboard
- therapist or educator tools
- fully new game generation from scratch

## Core product decision
The system should **not** generate a completely new game every time.

Instead, it should use a small set of **extendable templates** and let Codex generate:
- prompts
- words/items/content
- difficulty level
- level variations
- encouragement text

This keeps the games fast to generate, easy to debug, and simple enough for a hackathon demo.

## Game templates
### Reading template
**Game type:** Word-to-picture match

**Loop:**
- show a word
- show 2–4 image options
- child taps the correct image

**Examples of generated content:**
- cat
- ball
- sun
- tree

### Memory template
**Game type:** Card match or repeat-the-sequence

**Loop:**
- show a small set of cards or a short sequence
- child remembers and matches/repeats
- increase slightly if successful

### Attention template
**Game type:** Tap the target, avoid distractors

**Loop:**
- give a simple instruction like "Tap the star"
- show a small set of objects
- child taps only the correct target

## Functional requirements
### FR1 — Skill selection screen
The platform must show a child-friendly first screen with three large options:
- Reading
- Memory
- Attention

### FR2 — Template selection
The platform must map each skill area to a predefined game template.

### FR3 — Codex-generated game variation
The system must call Codex to generate a game variation based on:
- selected skill
- template type
- difficulty setting
- content items
- feedback copy

### FR4 — External game runtime
The generated game must run outside the app-server in its own runtime or port.

### FR5 — Short session design
Games must be simple, low-friction, and playable in 2–5 minutes.

### FR6 — Positive feedback loop
The game must provide short affirmative feedback after actions and at the end of the session.

### FR7 — Safe and simple UI
The child-facing UI must use:
- large buttons
- minimal text
- clear visual cues
- no complex navigation

## Non-functional requirements
- fast game generation for live demo use
- simple and reliable launch flow
- minimal UI latency
- predictable game behavior
- easy reset between sessions

## Technical approach
### Main components
#### 1. App shell
Handles:
- landing page
- skill selection
- launch game action

#### 2. Codex generation service
Handles:
- receiving chosen skill
- selecting template
- generating content/config
- returning game-ready JSON or component code

#### 3. Game runtime
Handles:
- rendering the game
- accepting generated config
- showing feedback
- ending the session

### Recommended implementation
Codex should generate a **JSON game config**, not an entire game engine.

Example:

```json
{
  "skill": "reading",
  "template": "word_picture_match",
  "difficulty": 1,
  "prompt": "Tap the picture that matches the word.",
  "items": [
    {
      "word": "cat",
      "choices": ["cat.png", "dog.png", "tree.png"],
      "correct": "cat.png"
    }
  ],
  "feedback": {
    "correct": "Great job!",
    "wrong": "Nice try!",
    "complete": "You finished!"
  }
}
```

## Suggested architecture
- `main-app` — selection screen and orchestration
- `codex-service` — template filling and content generation
- `game-runtime` — actual playable mini-game

## Success criteria
Phase 1 is successful if:
- the child can choose Reading, Memory, or Attention
- Codex generates a playable game variant from a template
- the game launches successfully
- the child can complete a short session
- the game gives short positive feedback throughout

## Demo script
1. Open the app.
2. Select **Reading**.
3. Show Codex generating a reading game from a template.
4. Launch the game in its own runtime.
5. Play one short round.
6. End with a positive completion message.

## Risks
### Risk
Game generation takes too long.

### Mitigation
Use template-based configs and keep each template small.

### Risk
The generated game feels inconsistent.

### Mitigation
Use fixed UI components and only vary content, not core mechanics.

### Risk
The experience feels too complex for children.

### Mitigation
Use short sessions, large targets, minimal text, and simple praise.
