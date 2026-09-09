import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), lookup: vi.fn(), insert: vi.fn(), db: vi.fn(), change: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.db }));
vi.mock("@/lib/meta/ads", () => ({ setMetaCampaignStatus: mocks.change }));
import { POST } from "@/app/api/campaigns/[id]/status/route";
const id = "12345678-1234-1234-1234-123456789abc";
const context = { params: Promise.resolve({ id }) };
const request = (body: object = { status: "PAUSED", expectedStatus: "ACTIVE" }, origin = "https://app.diced.com.br") => new NextRequest(`https://app.diced.com.br/api/campaigns/${id}/status`, { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
describe("campaign control authorization and confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ userId: "owner" });
    mocks.lookup.mockResolvedValue({ data: { id, meta_campaign_id: "123", meta_ad_account_id: "act_456" }, error: null });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.change.mockResolvedValue({ id: "123", status: "PAUSED", effective_status: "PAUSED" });
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.lookup, insert: mocks.insert };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain);
    mocks.db.mockReturnValue({ from: () => chain });
  });
  it("blocks unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("blocks cross-origin changes and unsupported statuses", async () => {
    expect((await POST(request({}, "https://evil.example"), context)).status).toBe(403);
    expect((await POST(request({ status: "DELETED", expectedStatus: "ACTIVE" }), context)).status).toBe(400);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("cannot change another owner's integration", async () => {
    mocks.lookup.mockResolvedValue({ data: null, error: null });
    expect((await POST(request(), context)).status).toBe(404);
    expect(mocks.change).not.toHaveBeenCalled();
  });
  it("uses stored account and campaign, ignoring caller supplied IDs", async () => {
    expect((await POST(request({ status: "PAUSED", expectedStatus: "ACTIVE", campaignId: "foreign", userId: "victim" }), context)).status).toBe(200);
    expect(mocks.change).toHaveBeenCalledWith("owner", "act_456", "123", "PAUSED", "ACTIVE");
  });
  it("does not report a failed Meta operation as success", async () => {
    mocks.change.mockRejectedValue(new Error("Permission denied"));
    expect((await POST(request(), context)).status).toBe(502);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("preserves confirmed success when history cannot be written", async () => {
    mocks.insert.mockResolvedValue({ error: { message: "unavailable" } });
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect((await response.json()).warning).toContain("histórico");
  });
});
