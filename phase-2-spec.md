# Phase 2 Spec — Progress Tracking and Adaptive Sessions

## Title
Adaptive Play — Phase 2: Track Progress and Personalize the Next Session

## Goal
Add a simple learning loop on top of Phase 1:
- store what the child did well
- store what the child struggled with
- use a lightweight database to save progress
- generate the next session to focus on improvement

This phase turns the product from a one-time game generator into a system that **remembers the child and adapts over time**.

## Why this phase matters
Phase 1 proves the product can generate games.
Phase 2 proves the product can **help learning progress** by using prior play data to guide the next session.

This is the point where the product becomes more than just a fun demo.

## Product experience
### Returning child flow
1. The child starts a new session.
2. The platform loads the child profile and recent session history.
3. The system checks:
   - which area was practiced
   - accuracy
   - repeated mistakes
   - response speed
   - signs of confusion or strength
4. The harness creates a simple progress summary.
5. Codex receives that summary and generates the next game variation.
6. The next game focuses a little more on the weak areas while still keeping the child encouraged.

## Scope
### In scope
- simple child profile
- session storage
- event tracking during gameplay
- progress summary generation
- adaptive next-session generation
- use of a simple database

### Out of scope
- parent-facing dashboard
- full analytics suite
- therapist notes
- advanced ML personalization
- medical or diagnostic interpretation

## Core product behavior
The system should track performance in a simple, understandable way and use that information to guide the next session.

Examples:
- if a child misses simple reading words, the next session should use easier words and more repetition
- if a child performs well in memory, the next session can slightly increase complexity
- if a child struggles with attention over time, the next session should shorten rounds and reduce distractors

## What should be tracked
### Reading
- correct answers
- wrong answers
- words commonly missed
- time to answer
- hints used

### Memory
- total matches found
- failed attempts
- longest correct sequence
- retries needed

### Attention
- correct taps
- taps on distractors
- reaction time
- performance drop during the round

## Functional requirements
### FR1 — Child profile
The system must store a basic child profile with:
- child ID
- name or nickname
- selected practice areas
- current difficulty per skill

### FR2 — Session logging
The system must store one record for each play session, including:
- child ID
- skill practiced
- template used
- session start and end time
- score summary

### FR3 — Gameplay event logging
The system must log gameplay events such as:
- selected answer
- correct or wrong result
- response time
- hint shown
- level completed

### FR4 — Progress summary generation
The harness must create a lightweight summary after each session, such as:
- best area
- weakest area
- most common error
- recommended next focus

### FR5 — Adaptive generation
When the child returns, the next game must be generated using:
- selected practice area
- last session results
- recent trend
- current target difficulty

### FR6 — Difficulty adjustment
The system must support simple rules for changing difficulty up or down.

### FR7 — Improvement focus
The next session should focus more heavily on repeated mistakes or weak areas without making the game feel punishing.

## Non-functional requirements
- simple and reliable persistence
- fast retrieval of recent session data
- low complexity database design
- easy debugging of adaptation logic
- clear internal logs for demo use

## Suggested database design
A simple relational database is enough.

### `children`
Stores:
- `id`
- `name`
- `preferred_skills`
- `reading_level`
- `memory_level`
- `attention_level`
- `created_at`

### `sessions`
Stores:
- `id`
- `child_id`
- `skill`
- `template`
- `score`
- `accuracy`
- `duration_seconds`
- `started_at`
- `ended_at`

### `events`
Stores:
- `id`
- `session_id`
- `event_type`
- `question_or_item`
- `selected_answer`
- `is_correct`
- `response_time_ms`
- `created_at`

### `recommendations`
Stores:
- `id`
- `child_id`
- `skill`
- `summary`
- `next_focus`
- `suggested_difficulty`
- `created_at`

## Adaptation logic
The adaptation logic should be simple and explainable.

### Example rules
- accuracy below 60% → lower difficulty slightly
- repeated mistakes on the same item type → repeat similar items next session
- high accuracy and fast completion → increase difficulty slightly
- many errors late in the round → shorten round length next time

## Harness responsibilities
The harness should:
- receive game events
- calculate session metrics
- save the session
- generate a progress summary
- prepare the next-game prompt for Codex

## Example Codex prompt input
```json
{
  "childId": "kid_01",
  "skill": "reading",
  "lastSession": {
    "accuracy": 0.5,
    "commonMistakes": ["cat", "ball"],
    "responseTimeAvgMs": 3400
  },
  "recommendation": {
    "focus": "repeat short simple words",
    "difficulty": 1
  }
}
```

## Example generated recommendation
- Child is doing well with visual matching.
- Child needs more practice on short reading words.
- Next session should repeat 4 easy words with fewer distractors.

## Technical approach
### New component
#### Agentic harness
The harness is the learning layer between gameplay and future generation.

It handles:
- ingesting events from the game
- updating progress in the database
- producing a summary for next-session generation

### Updated system flow
1. Child selects a skill.
2. System loads past data from the database.
3. Harness creates an adaptation summary.
4. Codex generates the next game config.
5. Game runs.
6. Events are stored.
7. Session summary is saved.

## Success criteria
Phase 2 is successful if:
- the system remembers a child across sessions
- the system stores results in a database
- the next generated game changes based on the previous session
- the change is understandable and visible in the demo

## Demo script
1. Play a first reading session and intentionally miss a few words.
2. Show the stored session data.
3. Start a second reading session.
4. Show that the next game now focuses on easier repeated words.
5. Explain how the harness used prior mistakes to adapt the game.

## Risks
### Risk
The personalization feels too smart or too opaque to explain.

### Mitigation
Use simple rules and visible summaries.

### Risk
Too much data is tracked for a hackathon.

### Mitigation
Track only session essentials and a few event types.

### Risk
Adaptation makes the game feel repetitive.

### Mitigation
Keep the same template but vary the content and encouragement.
