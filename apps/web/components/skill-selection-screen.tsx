"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Skill = "reading" | "memory" | "attention";

const SKILL_COPY: Record<
  Skill,
  { label: string; title: string; description: string }
> = {
  reading: {
    label: "Reading",
    title: "Reading",
    description: "Sing the sounds and tap the match."
  },
  memory: {
    label: "Memory",
    title: "Memory",
    description: "Watch the row and tap it back."
  },
  attention: {
    label: "Attention",
    title: "Attention",
    description: "Spot the target and give it a tap."
  }
};

type GenerateResponse = {
  gameId: string;
};

export function SkillSelectionScreen() {
  const router = useRouter();
  const [pendingSkill, setPendingSkill] = useState<Skill | null>(null);
  const [failedSkill, setFailedSkill] = useState<Skill | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const options = useMemo(() => Object.entries(SKILL_COPY) as Array<[Skill, (typeof SKILL_COPY)[Skill]]>, []);

  async function startGame(skill: Skill) {
    setErrorMessage(null);
    setFailedSkill(null);
    setPendingSkill(skill);

    try {
      const minimumLoading = new Promise((resolve) => {
        window.setTimeout(resolve, 450);
      });
      const request = {
        childId: "demo_child",
        skill,
        ageGroup: "5-8",
        difficultyLevel: 1
      };

      const responsePromise = fetch("/api/games/generate", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(request)
      });
      const [response] = await Promise.all([responsePromise, minimumLoading]);

      if (!response.ok) {
        throw new Error("Could not start that game yet.");
      }

      const data = (await response.json()) as GenerateResponse;

      if (!data.gameId) {
        throw new Error("The game is not ready yet.");
      }

      startTransition(() => {
        router.push(`/play/${data.gameId}`);
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something slowed down. Please try again."
      );
      setFailedSkill(skill);
      setPendingSkill(null);
    }
  }

  return (
    <main className="page">
      <div className="shell">
        <section className="hero" aria-labelledby="practice-heading">
          <div className="heroCopy">
            <div className="eyebrow">Bright play time</div>
            <h1 className="title" id="practice-heading">
              What would you like to practice today?
            </h1>
            <p className="lede">
              Pick a game and we&apos;ll keep each round bright, calm, and easy to follow.
            </p>
            <div className="heroChips" aria-label="Play qualities">
              <span>Calm wins</span>
              <span>Friendly pacing</span>
              <span>Joyful practice</span>
            </div>
          </div>
          <div className="heroArt">
            <Image
              src="/hero-inclusive-playroom.svg"
              alt="Three cheerful children playing together with sensory headphones, a wheelchair, and a communication tablet."
              width={640}
              height={420}
              priority
            />
          </div>
        </section>

        <div className="supportStrip" aria-label="Practice supports">
          <span>Calm starts</span>
          <span>Clear prompts</span>
          <span>No-rush rounds</span>
        </div>

        <section className="sectionBand" aria-label="Select a practice area">
          <div className="sectionHeading">
            <div>
              <h2>Choose a skill</h2>
              <p>Each one launches a short game with room for different bodies, brains, and paces.</p>
            </div>
            <Link className="ghostButton parentLinkButton" href="/parent/demo_child/dashboard">
              Parent dashboard
            </Link>
          </div>

          <div className="skillGrid">
            {options.map(([skill, copy]) => (
              <button
                key={skill}
                type="button"
                className="skillButton"
                data-skill={skill}
                data-testid={`skill-${skill}`}
                onClick={() => startGame(skill)}
                disabled={pendingSkill !== null}
              >
                <div className="skillBadge">{copy.label}</div>
                <strong>{copy.title}</strong>
                <span>{copy.description}</span>
              </button>
            ))}
          </div>

          <div className="statusRow" aria-live="polite">
            {pendingSkill ? (
              <div className="loadingCard" data-testid="generation-status">
                <div className="loadingDots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <strong>Getting your game ready</strong>
              </div>
            ) : null}

            {errorMessage ? (
              <div className="retryRow">
                <div
                  className="statusPill error"
                  role="status"
                  data-testid="generation-error"
                >
                  {errorMessage}
                </div>
                {failedSkill ? (
                  <button
                    type="button"
                    className="ghostButton"
                    onClick={() => startGame(failedSkill)}
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
