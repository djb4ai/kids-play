import React, { useEffect, useMemo, useRef, useState } from "react";
import { isGameSession, type GameItem, type GameRound, type GameRuntimeEvent, type GameSession, type TemplateType } from "./contracts";

const PLATFORM_ORIGIN =
  import.meta.env.VITE_PLATFORM_ORIGIN ?? "http://127.0.0.1:3000";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; session: GameSession }
  | { status: "error"; message: string };

type Phase = "watch" | "play" | "complete";

const TEMPLATE_COPY: Record<
  TemplateType,
  { heading: string; subtitle: string; label: string }
> = {
  reading_word_match: {
    heading: "Reading Time",
    subtitle: "Look at the clue and tap the right picture.",
    label: "Read"
  },
  reading_picture_clue: {
    heading: "Reading Time",
    subtitle: "Read the word and tap the matching picture.",
    label: "Read"
  },
  memory_sequence: {
    heading: "Memory Time",
    subtitle: "Watch carefully, then tap the same order.",
    label: "Watch"
  },
  memory_shape_path: {
    heading: "Memory Time",
    subtitle: "Watch the shape path, then tap it back.",
    label: "Watch"
  },
  attention_target_tap: {
    heading: "Focus Time",
    subtitle: "Tap the target and keep your eyes on the prize.",
    label: "Focus"
  },
  attention_shape_scan: {
    heading: "Focus Time",
    subtitle: "Find the named shape and tap it.",
    label: "Focus"
  }
};

const IMAGE_PATHS: Record<string, string> = {
  apple: "/assets/apple.svg",
  ball: "/assets/ball.svg",
  book: "/assets/book.svg",
  cat: "/assets/cat.svg",
  circle: "/assets/circle.svg",
  fish: "/assets/fish.svg",
  leaf: "/assets/leaf.svg",
  moon: "/assets/moon.svg",
  square: "/assets/square.svg",
  star: "/assets/star.svg",
  sun: "/assets/sun.svg",
  tree: "/assets/tree.svg"
};

function getGameIdFromPathname(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "game" && segments[1]) {
    return segments[1];
  }
  return segments[segments.length - 1] ?? "";
}

function postRuntimeEvent(event: GameRuntimeEvent) {
  if (window.parent !== window) {
    window.parent.postMessage(event, PLATFORM_ORIGIN);
  }
}

function goHome(gameId: string) {
  if (window.parent !== window) {
    postRuntimeEvent({ type: "kids-play:go-home", gameId });
    return;
  }

  window.location.href = PLATFORM_ORIGIN;
}

function isMemoryTemplate(templateType: TemplateType) {
  return templateType === "memory_sequence" || templateType === "memory_shape_path";
}

async function loadSession(gameId: string, signal: AbortSignal): Promise<GameSession> {
  const response = await fetch(`${PLATFORM_ORIGIN}/api/games/${gameId}`, {
    signal,
    headers: {
      accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error("We could not load this game yet.");
  }

  const payload = await response.json();
  if (!isGameSession(payload)) {
    throw new Error("We could not load this game yet.");
  }

  return payload;
}

function useSession(gameId: string) {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    setState({ status: "loading" });
    loadSession(gameId, controller.signal)
      .then((session) => {
        setState({ status: "ready", session });
        postRuntimeEvent({ type: "kids-play:game-started", gameId });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "We could not load this game yet."
        });
      });

    return () => controller.abort();
  }, [gameId]);

  return state;
}

function useRoundFlow(session: GameSession) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(
    isMemoryTemplate(session.templateType) ? "watch" : "play"
  );
  const [memoryRevealCount, setMemoryRevealCount] = useState(0);
  const [sequenceCursor, setSequenceCursor] = useState(0);
  const [score, setScore] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    session.feedback.correct[0] ?? "Great job!"
  );
  const [lockedChoice, setLockedChoice] = useState<string | null>(null);
  const completedRef = useRef(false);

  const round = session.rounds[roundIndex];
  const total = session.rounds.length;
  const complete = phase === "complete";

  useEffect(() => {
    setRoundIndex(0);
    setPhase(isMemoryTemplate(session.templateType) ? "watch" : "play");
    setMemoryRevealCount(0);
    setSequenceCursor(0);
    setScore(0);
    setStatusMessage(session.feedback.correct[0] ?? "Great job!");
    setLockedChoice(null);
    completedRef.current = false;
  }, [session]);

  useEffect(() => {
    if (!round || !isMemoryTemplate(session.templateType) || phase !== "watch") {
      return;
    }

    setMemoryRevealCount(0);
    setSequenceCursor(0);
    setStatusMessage(session.feedback.correct[0] ?? "Great job!");

    const revealTimers: number[] = [];
    const sequence = round.sequence ?? [];

    sequence.forEach((_, index) => {
      revealTimers.push(
        window.setTimeout(() => {
          setMemoryRevealCount(index + 1);
          if (index === sequence.length - 1) {
            setStatusMessage("Your turn!");
          }
        }, 550 + index * 700)
      );
    });

    revealTimers.push(
      window.setTimeout(() => {
        setPhase("play");
      }, 700 + sequence.length * 700)
    );

    return () => {
      revealTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [phase, round, session.feedback.correct, session.templateType]);

  function finishGame(finalScore: number) {
    if (completedRef.current) {
      return;
    }

    completedRef.current = true;
    setPhase("complete");
    const completionMessage = session.feedback.complete[0] ?? "You did it!";
    setStatusMessage(completionMessage);
    postRuntimeEvent({
      type: "kids-play:feedback",
      gameId: session.gameId,
      message: completionMessage
    });
    postRuntimeEvent({
      type: "kids-play:complete",
      gameId: session.gameId,
      summary: { correct: finalScore, total }
    });
  }

  function advanceRound(nextScore: number) {
    const nextRoundIndex = roundIndex + 1;
    if (nextRoundIndex >= total) {
      finishGame(nextScore);
      return;
    }

    setRoundIndex(nextRoundIndex);
    setPhase(isMemoryTemplate(session.templateType) ? "watch" : "play");
    setMemoryRevealCount(0);
    setSequenceCursor(0);
    setLockedChoice(null);
  }

  function choose(itemId: string) {
    if (!round || phase === "complete") {
      return;
    }

    if (isMemoryTemplate(session.templateType)) {
      if (phase !== "play") {
        return;
      }

      const expected = round.correctSequence?.[sequenceCursor];
      if (expected === itemId) {
        const nextCursor = sequenceCursor + 1;
        const nextScore = sequenceCursor + 1 >= (round.correctSequence?.length ?? 0)
          ? score + 1
          : score;

        setLockedChoice(itemId);
        const nextMessage =
          session.feedback.correct[nextCursor % session.feedback.correct.length] ??
          "Great job!";
        setStatusMessage(nextMessage);
        postRuntimeEvent({
          type: "kids-play:feedback",
          gameId: session.gameId,
          message: nextMessage
        });

        if (nextCursor >= (round.correctSequence?.length ?? 0)) {
          setScore(nextScore);
          window.setTimeout(() => advanceRound(nextScore), 700);
        } else {
          setSequenceCursor(nextCursor);
          window.setTimeout(() => setLockedChoice(null), 250);
        }
      } else {
        const message = session.feedback.tryAgain[0] ?? "Nice try!";
        setStatusMessage(message);
        postRuntimeEvent({
          type: "kids-play:feedback",
          gameId: session.gameId,
          message
        });
      }

      return;
    }

    if (round.correctChoice === itemId) {
      const nextScore = score + 1;
      const message = session.feedback.correct[0] ?? "Great job!";
      setScore(nextScore);
      setStatusMessage(message);
      postRuntimeEvent({
        type: "kids-play:feedback",
        gameId: session.gameId,
        message
      });
      window.setTimeout(() => advanceRound(nextScore), 650);
    } else {
      const message = session.feedback.tryAgain[0] ?? "Nice try!";
      setStatusMessage(message);
      postRuntimeEvent({
        type: "kids-play:feedback",
        gameId: session.gameId,
        message
      });
    }
  }

  return {
    round,
    complete,
    phase,
    score,
    total,
    statusMessage,
    lockedChoice,
    memoryRevealCount,
    sequenceCursor,
    choose
  };
}

function ItemIcon({ item }: { item: GameItem }) {
  return (
    <span className="item-art" aria-hidden="true">
      <img src={IMAGE_PATHS[item.imageKey]} alt="" />
    </span>
  );
}

function RoundButton({
  item,
  active,
  disabled,
  onClick
}: {
  item: GameItem;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={["round-button", active ? "is-active" : ""].join(" ")}
      data-testid={`choice-${item.id}`}
      onClick={onClick}
      disabled={disabled}
    >
      <ItemIcon item={item} />
      <span className="round-button-label">{item.label}</span>
      {item.value ? <span className="round-button-badge">{item.value}</span> : null}
    </button>
  );
}

function MemorySequence({
  session,
  round,
  revealCount,
  phase
}: {
  session: GameSession;
  round: GameRound;
  revealCount: number;
  phase: Phase;
}) {
  const sequence = round.sequence ?? [];

  return (
    <div className="memory-sequence" aria-live="polite">
      {sequence.map((id, index) => {
        const item = session.items.find((candidate) => candidate.id === id);
        if (!item) {
          return null;
        }

        const visible = phase === "watch" ? index < revealCount : false;
        return (
          <div key={id} className={["memory-card", visible ? "is-visible" : ""].join(" ")}>
            {visible ? <ItemIcon item={item} /> : <span className="memory-question">?</span>}
          </div>
        );
      })}
    </div>
  );
}

function GameStage({ session }: { session: GameSession }) {
  const copy = TEMPLATE_COPY[session.templateType];
  const { round, complete, phase, score, total, statusMessage, lockedChoice, memoryRevealCount, sequenceCursor, choose } =
    useRoundFlow(session);

  return (
    <main className="shell" data-testid="game-runtime">
      <section className="board">
        <header className="board-top">
          <div className="board-copy">
            <img className="mascot" src="/assets/melon-buddy.svg" alt="" />
            <div>
              <p className="eyebrow">
                {copy.label} | {copy.heading}
              </p>
              <h1>{session.title}</h1>
              <p>{copy.subtitle}</p>
              <p className="small">{session.instructions}</p>
            </div>
          </div>
          <div className="score-pill" aria-label={`Score ${score} of ${total}`}>
            {score}/{total}
          </div>
        </header>

        <section className="status-row" aria-live="polite" data-testid="game-feedback">
          <p className="status-text">{statusMessage}</p>
        </section>

        {round && !complete ? (
          <section className="round-area">
            <div className="round-head">
              <span className="round-count">{round.id.replace(/_/g, " ")}</span>
              <p>{round.prompt}</p>
            </div>

            {isMemoryTemplate(session.templateType) ? (
              <>
                <MemorySequence
                  session={session}
                  round={round}
                  revealCount={memoryRevealCount}
                  phase={phase}
                />
                <div className="memory-progress">
                  Step {Math.min(sequenceCursor + 1, round.correctSequence?.length ?? 1)} of{" "}
                  {round.correctSequence?.length ?? 1}
                </div>
              </>
            ) : null}

            <div className="choice-grid">
              {round.choices.map((choiceId) => {
                const item = session.items.find((candidate) => candidate.id === choiceId);
                if (!item) {
                  return null;
                }

                const active =
                  isMemoryTemplate(session.templateType) &&
                  phase === "play" &&
                  lockedChoice === null &&
                  item.id === round.correctSequence?.[sequenceCursor];

                return (
                  <RoundButton
                    key={choiceId}
                    item={item}
                    active={active}
                    disabled={
                      isMemoryTemplate(session.templateType) &&
                      (phase !== "play" || lockedChoice !== null)
                    }
                    onClick={() => choose(choiceId)}
                  />
                );
              })}
            </div>
          </section>
        ) : (
          <section className="complete-area" data-testid="game-complete">
            <img className="celebration" src="/assets/celebration.svg" alt="" />
            <h2>Well done!</h2>
            <p>You finished this round of practice.</p>
            <div className="finish-pill">
              {session.feedback.complete[0] ?? "You did it!"}
            </div>
            <button
              type="button"
              className="home-button"
              data-testid="game-home-button"
              onClick={() => goHome(session.gameId)}
            >
              Choose another skill
            </button>
          </section>
        )}
      </section>
    </main>
  );
}

function GamePlayer() {
  const gameId = useMemo(() => getGameIdFromPathname(window.location.pathname), []);
  const sessionState = useSession(gameId);

  if (!gameId) {
    return (
      <main className="shell">
        <section className="panel">
          <h1>Let’s play</h1>
          <p>We could not find a game to open.</p>
        </section>
      </main>
    );
  }

  if (sessionState.status === "loading") {
    return (
      <main className="shell">
        <section className="panel panel-loading">
          <img className="mascot" src="/assets/melon-buddy.svg" alt="" />
          <h1>Loading your game</h1>
          <p>Almost ready.</p>
        </section>
      </main>
    );
  }

  if (sessionState.status === "error") {
    return (
      <main className="shell">
        <section className="panel">
          <img className="mascot" src="/assets/melon-buddy.svg" alt="" />
          <h1>Let’s try that again</h1>
          <p>{sessionState.message}</p>
          <p className="small">Please go back and choose a skill again.</p>
        </section>
      </main>
    );
  }

  return <GameStage session={sessionState.session} />;
}

export default GamePlayer;
