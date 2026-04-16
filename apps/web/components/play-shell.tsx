"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GameplayEvent } from "@kids-play/shared";

type GameSessionSummary = {
  childId?: string;
  title?: string;
  instructions?: string;
};

type RuntimeEvent =
  | { type: "kids-play:game-started"; gameId: string }
  | { type: "kids-play:feedback"; gameId: string; message: string }
  | { type: "kids-play:game-event"; gameId: string; event: GameplayEvent }
  | { type: "kids-play:complete"; gameId: string; summary?: { correct: number; total: number } }
  | { type: "kids-play:go-home"; gameId: string };

const DEFAULT_ORIGIN = "http://127.0.0.1:3001";

export function PlayShell({
  gameId,
  runtimeOrigin = DEFAULT_ORIGIN
}: {
  gameId: string;
  runtimeOrigin?: string;
}) {
  const router = useRouter();
  const runtimeUrl = useMemo(
    () => `${runtimeOrigin}/game/${encodeURIComponent(gameId)}`,
    [gameId, runtimeOrigin]
  );

  const [session, setSession] = useState<GameSessionSummary>({});
  const [runtimeLoaded, setRuntimeLoaded] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [message, setMessage] = useState("Getting ready");
  const [completed, setCompleted] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const eventsRef = useRef<GameplayEvent[]>([]);
  const sessionStartedAtRef = useRef<string | null>(null);
  const saveStartedRef = useRef(false);

  useEffect(() => {
    let active = true;

    fetch(`/api/games/${encodeURIComponent(gameId)}`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load session.");
        }
        return (await response.json()) as GameSessionSummary;
      })
      .then((data) => {
        if (active) {
          setSession(data);
        }
      })
      .catch(() => {
        if (active) {
          setSession({});
        }
      });

    return () => {
      active = false;
    };
  }, [gameId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== runtimeOrigin) {
        return;
      }

      if (typeof event.data !== "object" || event.data === null) {
        return;
      }

      const data = event.data as RuntimeEvent;
      if (data.gameId !== gameId) {
        return;
      }

      if (data.type === "kids-play:game-started") {
        sessionStartedAtRef.current ??= new Date().toISOString();
        setGameStarted(true);
        setMessage("Great start!");
        return;
      }

      if (data.type === "kids-play:game-event") {
        eventsRef.current = [...eventsRef.current, data.event];
        if (data.event.eventType === "game_started") {
          sessionStartedAtRef.current = data.event.timestamp;
        }
        return;
      }

      if (data.type === "kids-play:feedback") {
        setMessage(data.message);
        return;
      }

      if (data.type === "kids-play:complete") {
        setCompleted(true);
        setMessage(
          data.summary
            ? `Well done! ${data.summary.correct}/${data.summary.total}`
            : "Well done!"
        );
        void saveCompletedSession(data.summary ?? { correct: 0, total: 1 });
        return;
      }

      if (data.type === "kids-play:go-home") {
        router.push("/");
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [gameId, router, runtimeOrigin, session.childId]);

  useEffect(() => {
    eventsRef.current = [];
    sessionStartedAtRef.current = null;
    saveStartedRef.current = false;
  }, [gameId]);

  async function saveCompletedSession(summary: { correct: number; total: number }) {
    if (saveStartedRef.current) {
      return;
    }

    saveStartedRef.current = true;
    const endedAt = new Date().toISOString();
    const events =
      eventsRef.current.length > 0
        ? eventsRef.current
        : [{ eventType: "game_completed" as const, timestamp: endedAt }];

    try {
      await fetch("/api/session/save", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          gameId,
          childId: session.childId ?? "demo_child",
          startedAt: sessionStartedAtRef.current ?? events[0]?.timestamp ?? endedAt,
          endedAt,
          summary,
          events
        })
      });
    } catch (error) {
      console.error("[kids-play] session save request failed", error);
    }
  }

  return (
    <main className="page">
      <div className="playShell">
        <header className="playHeader">
          <div>
            <div className="eyebrow">Happy practice</div>
            <h1>{session.title ?? "Your game is ready"}</h1>
            <p>{session.instructions ?? "Play a short round and keep going."}</p>
          </div>
          <Image
            src="/music-rainbow.svg"
            alt=""
            width={168}
            height={120}
            aria-hidden="true"
          />
        </header>

        <section className="playStatus" aria-live="polite">
          <div className={`playMessage ${completed ? "complete" : ""}`}>
            {message}
          </div>
          <div className="statusPill">
            {gameStarted ? "Game started" : runtimeLoaded ? "Ready to play" : "Loading game"}
          </div>
          {loadFailed ? <div className="statusPill error">Something slowed down</div> : null}
        </section>

        {completed ? (
          <section className="loadingCard" data-testid="play-complete" aria-live="polite">
            <strong>Nice work.</strong>
            <span>You finished the round.</span>
            <div className="completionActions">
              <Link className="homeButton" href="/" data-testid="home-link">
                Choose another skill
              </Link>
              <Link className="ghostButton parentLinkButton" href="/parent/demo_child/dashboard">
                See progress
              </Link>
            </div>
          </section>
        ) : null}

        <section className="runtimeFrame" aria-label="Game runtime">
          <iframe
            data-testid="game-frame"
            src={runtimeUrl}
            title="Kids Play game runtime"
            onLoad={() => setRuntimeLoaded(true)}
            onError={() => {
              setLoadFailed(true);
              setMessage("Let's try that again.");
            }}
            allow="clipboard-read; clipboard-write"
          />
        </section>
      </div>
    </main>
  );
}
