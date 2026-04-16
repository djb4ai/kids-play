"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  ParentDashboard,
  ParentSessionDetail,
  ParentSessionListItem,
  ParentSkillDetail,
  ParentSkillSummary
} from "@kids-play/shared";

type LoadState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

export function ParentDashboardScreen({ childId }: { childId: string }) {
  const state = useJsonFetch<ParentDashboard>(`/api/parent/${encodeURIComponent(childId)}/dashboard`);

  if (state.loading) {
    return <ParentStateShell title="Parent dashboard" message="Pulling together recent practice." />;
  }

  if (state.error || !state.data) {
    return (
      <ParentStateShell
        title="Parent dashboard"
        message={state.error ?? "Parent dashboard was not available."}
        error
      />
    );
  }

  const dashboard = state.data;

  return (
    <main className="page">
      <div className="shell parentShell">
        <ParentHeader
          eyebrow="Family view"
          title={`${dashboard.displayName}'s progress`}
          description={dashboard.summary}
          childId={childId}
        />

        <section className="parentGrid parentTopGrid">
          <article className="parentCard parentSummaryCard">
            <div className="parentStatRow">
              <ParentStat label="Sessions played" value={`${dashboard.totalSessions}`} />
              <ParentStat
                label="Last active"
                value={dashboard.lastPlayedAt ? formatDate(dashboard.lastPlayedAt) : "Not yet"}
              />
              <ParentStat label="Current focus" value={dashboard.currentFocus} />
            </div>
          </article>

          <article className="parentCard">
            <SectionHeading title="Next session focus" linkHref={`/parent/${childId}/sessions`} linkLabel="All sessions" />
            <p className="parentBodyText">{dashboard.currentFocus}</p>
          </article>
        </section>

        <section className="parentCard">
          <SectionHeading title="Skill progress" />
          <div className="parentSkillGrid">
            {dashboard.skills.map((skill) => (
              <SkillCard key={skill.skill} childId={childId} skill={skill} />
            ))}
          </div>
        </section>

        <section className="parentGrid">
          <article className="parentCard">
            <SectionHeading title="Doing well" />
            <SupportList
              items={dashboard.strengths}
              emptyMessage="A few more sessions will make strengths clearer."
            />
          </article>

          <article className="parentCard">
            <SectionHeading title="Needs more support" />
            <SupportList
              items={dashboard.supportAreas}
              emptyMessage="Nothing urgent yet. More sessions will fill this in."
            />
          </article>
        </section>

        <section className="parentCard">
          <SectionHeading
            title="Recent sessions"
            linkHref={`/parent/${childId}/sessions`}
            linkLabel="See all"
          />
          {dashboard.recentSessions.length > 0 ? (
            <SessionList childId={childId} sessions={dashboard.recentSessions} />
          ) : (
            <EmptyCard message="No sessions yet. Once your child completes a game, progress will appear here." />
          )}
        </section>
      </div>
    </main>
  );
}

export function ParentSessionsScreen({ childId }: { childId: string }) {
  const state = useJsonFetch<ParentSessionListItem[]>(
    `/api/parent/${encodeURIComponent(childId)}/sessions`
  );

  if (state.loading) {
    return <ParentStateShell title="Recent sessions" message="Loading session history." childId={childId} />;
  }

  if (state.error || !state.data) {
    return (
      <ParentStateShell
        title="Recent sessions"
        message={state.error ?? "Session history was not available."}
        childId={childId}
        error
      />
    );
  }

  return (
    <main className="page">
      <div className="shell parentShell">
        <ParentHeader
          eyebrow="Family view"
          title="Recent sessions"
          description="A quick look at each round, when it happened, and what it suggested for next time."
          childId={childId}
        />

        <section className="parentCard">
          {state.data.length > 0 ? (
            <SessionList childId={childId} sessions={state.data} />
          ) : (
            <EmptyCard message="Only one finished game can start this story. Once a session is completed, it will show up here." />
          )}
        </section>
      </div>
    </main>
  );
}

export function ParentSessionDetailScreen({
  childId,
  sessionId
}: {
  childId: string;
  sessionId: string;
}) {
  const state = useJsonFetch<ParentSessionDetail>(
    `/api/parent/${encodeURIComponent(childId)}/sessions/${encodeURIComponent(sessionId)}`
  );

  if (state.loading) {
    return <ParentStateShell title="Session detail" message="Loading this session." childId={childId} />;
  }

  if (state.error || !state.data) {
    return (
      <ParentStateShell
        title="Session detail"
        message={state.error ?? "Session detail was not available."}
        childId={childId}
        error
      />
    );
  }

  const session = state.data;

  return (
    <main className="page">
      <div className="shell parentShell">
        <ParentHeader
          eyebrow={session.skillLabel}
          title={`${session.skillLabel} session`}
          description={session.interpretation}
          childId={childId}
        />

        <section className="parentGrid parentTopGrid">
          <article className="parentCard">
            <div className="parentStatRow">
              <ParentStat label="Played on" value={formatDate(session.endedAt)} />
              <ParentStat label="Score" value={`${session.score}/${session.totalTasks}`} />
              <ParentStat label="Accuracy" value={formatPercent(session.accuracy)} />
              <ParentStat
                label="Average response"
                value={session.averageResponseTimeMs ? `${session.averageResponseTimeMs} ms` : "Not tracked"}
              />
            </div>
          </article>

          <article className="parentCard">
            <SectionHeading title="Next focus" />
            <p className="parentBodyText">{session.nextFocus ?? "Start with another short round."}</p>
          </article>
        </section>

        <section className="parentGrid">
          <article className="parentCard">
            <SectionHeading title="Doing well" />
            <SupportList items={session.strengths} emptyMessage="This session mostly helped us learn what to support next." />
          </article>
          <article className="parentCard">
            <SectionHeading title="Needs more support" />
            <SupportList items={session.supportAreas} emptyMessage="No clear support areas were flagged in this round." />
          </article>
        </section>

        <section className="parentGrid">
          <article className="parentCard">
            <SectionHeading title="Round details" />
            <div className="metricList">
              <MetricRow label="Correct answers" value={`${session.correctAnswers}`} />
              <MetricRow label="Incorrect answers" value={`${session.incorrectAnswers}`} />
              <MetricRow label="Retries" value={`${session.retries}`} />
              <MetricRow label="Hints used" value={`${session.hintsUsed}`} />
              <MetricRow label="Duration" value={formatDuration(session.durationMs)} />
            </div>
          </article>

          <article className="parentCard">
            <SectionHeading title="Common repeats" />
            <SupportList items={session.commonMistakes} emptyMessage="There were no repeated misses in this round." />
            {session.recommendationSummary ? (
              <p className="parentNote">{session.recommendationSummary}</p>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}

export function ParentSkillDetailScreen({
  childId,
  skill
}: {
  childId: string;
  skill: string;
}) {
  const state = useJsonFetch<ParentSkillDetail>(
    `/api/parent/${encodeURIComponent(childId)}/skills/${encodeURIComponent(skill)}`
  );

  if (state.loading) {
    return <ParentStateShell title="Skill detail" message="Loading skill progress." childId={childId} />;
  }

  if (state.error || !state.data) {
    return (
      <ParentStateShell
        title="Skill detail"
        message={state.error ?? "Skill detail was not available."}
        childId={childId}
        error
      />
    );
  }

  const detail = state.data;

  return (
    <main className="page">
      <div className="shell parentShell">
        <ParentHeader
          eyebrow={detail.skillLabel}
          title={`${detail.skillLabel} progress`}
          description={detail.summary}
          childId={childId}
        />

        <section className="parentGrid parentTopGrid">
          <article className="parentCard">
            <div className="parentStatRow">
              <ParentStat label="Sessions played" value={`${detail.sessionsPlayed}`} />
              <ParentStat
                label="Latest accuracy"
                value={detail.latestAccuracy === null ? "Not yet" : formatPercent(detail.latestAccuracy)}
              />
              <ParentStat
                label="Average accuracy"
                value={detail.averageAccuracy === null ? "Not yet" : formatPercent(detail.averageAccuracy)}
              />
              <ParentStat label="Trend" value={trendLabel(detail.trend)} />
            </div>
          </article>

          <article className="parentCard">
            <SectionHeading title="Next focus" />
            <p className="parentBodyText">{detail.nextFocus}</p>
          </article>
        </section>

        <section className="parentGrid">
          <article className="parentCard">
            <SectionHeading title="Doing well" />
            <SupportList items={detail.strengths} emptyMessage="More practice will help this picture fill in." />
          </article>
          <article className="parentCard">
            <SectionHeading title="Needs more support" />
            <SupportList items={detail.supportAreas} emptyMessage="No support areas have been flagged yet." />
          </article>
        </section>

        <section className="parentCard">
          <SectionHeading title="Recent sessions" />
          {detail.recentSessions.length > 0 ? (
            <SessionList childId={childId} sessions={detail.recentSessions} />
          ) : (
            <EmptyCard message={`No ${detail.skillLabel.toLowerCase()} sessions yet.`} />
          )}
        </section>
      </div>
    </main>
  );
}

function ParentHeader({
  eyebrow,
  title,
  description,
  childId
}: {
  eyebrow: string;
  title: string;
  description: string;
  childId?: string;
}) {
  return (
    <header className="parentHeader">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="parentHeaderActions">
        {childId ? (
          <Link className="ghostButton parentLinkButton" href={`/parent/${childId}/dashboard`}>
            Dashboard
          </Link>
        ) : null}
        <Link className="homeButton" href="/">
          Play a game
        </Link>
      </div>
    </header>
  );
}

function SectionHeading({
  title,
  linkHref,
  linkLabel
}: {
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="sectionHeading parentSectionHeading">
      <div>
        <h2>{title}</h2>
      </div>
      {linkHref && linkLabel ? (
        <Link className="parentInlineLink" href={linkHref}>
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function SkillCard({ childId, skill }: { childId: string; skill: ParentSkillSummary }) {
  return (
    <Link className="parentMiniCard" href={`/parent/${childId}/skills/${skill.skill}`}>
      <div className="skillBadge">{skill.label}</div>
      <strong>{trendLabel(skill.trend)}</strong>
      <span>
        {skill.sessionsPlayed === 0
          ? "No sessions yet."
          : `${skill.sessionsPlayed} session${skill.sessionsPlayed === 1 ? "" : "s"} played`}
      </span>
      <span>
        {skill.latestAccuracy === null ? "Practice will show up here." : `${formatPercent(skill.latestAccuracy)} accuracy last round`}
      </span>
    </Link>
  );
}

function SessionList({
  childId,
  sessions
}: {
  childId: string;
  sessions: ParentSessionListItem[];
}) {
  return (
    <div className="sessionList">
      {sessions.map((session) => (
        <article key={session.sessionId} className="sessionRow">
          <div>
            <div className="skillBadge">{session.skillLabel}</div>
            <strong>{formatDate(session.endedAt)}</strong>
            <p>{session.interpretation}</p>
          </div>
          <div className="sessionMeta">
            <span>{`${session.score}/${session.totalTasks}`}</span>
            <span>{formatPercent(session.accuracy)}</span>
            <Link href={`/parent/${childId}/sessions/${session.sessionId}`}>Details</Link>
          </div>
        </article>
      ))}
    </div>
  );
}

function ParentStateShell({
  title,
  message,
  childId,
  error = false
}: {
  title: string;
  message: string;
  childId?: string;
  error?: boolean;
}) {
  return (
    <main className="page">
      <div className="shell parentShell">
        <ParentHeader
          eyebrow="Family view"
          title={title}
          description={message}
          childId={childId}
        />
        <div className={`loadingCard parentStateCard ${error ? "errorState" : ""}`}>
          <span>{message}</span>
        </div>
      </div>
    </main>
  );
}

function EmptyCard({ message }: { message: string }) {
  return <div className="parentEmpty">{message}</div>;
}

function SupportList({
  items,
  emptyMessage
}: {
  items: string[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <div className="parentEmpty">{emptyMessage}</div>;
  }

  return (
    <ul className="parentList">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function ParentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="parentStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="metricRow">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function useJsonFetch<T>(url: string): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({
    data: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let active = true;

    setState({ data: null, loading: true, error: null });

    fetch(url)
      .then(async (response) => {
        const body = (await response.json()) as T & { error?: string };
        if (!response.ok) {
          throw new Error(typeof body.error === "string" ? body.error : "Something slowed down.");
        }
        return body as T;
      })
      .then((data) => {
        if (active) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: null,
            loading: false,
            error: error instanceof Error ? error.message : "Something slowed down."
          });
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return state;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `${seconds}s`;
}

function trendLabel(trend: string) {
  if (trend === "improving") {
    return "Improving";
  }
  if (trend === "needs_support") {
    return "Needs support";
  }
  if (trend === "new") {
    return "Just getting started";
  }
  return "Steady";
}
