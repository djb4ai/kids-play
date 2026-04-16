import { afterEach, describe, expect, it, vi } from "vitest";

const getParentDashboard = vi.fn();
const getParentSessions = vi.fn();
const getParentSessionDetail = vi.fn();
const getParentSkillDetail = vi.fn();

vi.mock("@/lib/learning-store", () => ({
  getLearningStore: () => ({
    getParentDashboard,
    getParentSessions,
    getParentSessionDetail,
    getParentSkillDetail
  })
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("parent api routes", () => {
  it("returns dashboard data", async () => {
    getParentDashboard.mockReturnValue({ childId: "demo_child", totalSessions: 0 });
    const { GET } = await import("../app/api/parent/[childId]/dashboard/route");

    const response = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ childId: "demo_child" })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ childId: "demo_child" });
  });

  it("validates session limit query", async () => {
    const { GET } = await import("../app/api/parent/[childId]/sessions/route");

    const response = await GET(new Request("http://localhost/api?limit=bad"), {
      params: Promise.resolve({ childId: "demo_child" })
    });

    expect(response.status).toBe(400);
  });

  it("returns session detail not found when missing", async () => {
    getParentSessionDetail.mockReturnValue(null);
    const { GET } = await import("../app/api/parent/[childId]/sessions/[sessionId]/route");

    const response = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ childId: "demo_child", sessionId: "missing" })
    });

    expect(response.status).toBe(404);
  });

  it("rejects unknown skills", async () => {
    const { GET } = await import("../app/api/parent/[childId]/skills/[skill]/route");

    const response = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ childId: "demo_child", skill: "math" })
    });

    expect(response.status).toBe(400);
  });

  it("returns skill detail when skill is valid", async () => {
    getParentSkillDetail.mockReturnValue({ skill: "reading", sessionsPlayed: 1 });
    const { GET } = await import("../app/api/parent/[childId]/skills/[skill]/route");

    const response = await GET(new Request("http://localhost/api"), {
      params: Promise.resolve({ childId: "demo_child", skill: "reading" })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skill: "reading" });
  });
});
