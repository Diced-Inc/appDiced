import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), maybeSingle: vi.fn(), insert: vi.fn(), getDb: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: mocks.getDb }));
import { GET, POST } from "@/app/api/campaigns/[id]/route";
const id = "12345678-1234-1234-1234-123456789abc";
const context = { params: Promise.resolve({ id }) };
const request = (method = "GET", body?: object) => new NextRequest(`https://app.diced.com.br/api/campaigns/${id}?section=history`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });

describe("campaign ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.maybeSingle.mockResolvedValue({ data: null, error: null }); mocks.insert.mockResolvedValue({ error: null });
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: mocks.maybeSingle, insert: mocks.insert };
    chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain); mocks.getDb.mockReturnValue({ from: () => chain });
  });
  it("rejects unauthenticated reads and writes before accessing the database", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    expect((await GET(request(), context)).status).toBe(401);
    expect((await POST(request("POST", { note: "test" }), context)).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("does not read or write a campaign outside the owner lookup", async () => {
    expect((await GET(request(), context)).status).toBe(404);
    expect((await POST(request("POST", { note: "test", userId: "victim" }), context)).status).toBe(404);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("uses the authenticated owner rather than caller-supplied identifiers", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id, user_id: "owner" }, error: null });
    expect((await POST(request("POST", { note: "Manter orçamento", userId: "victim", integration_id: "foreign" }), context)).status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith({ integration_id: id, user_id: "owner", kind: "decision", note: "Manter orçamento" });
  });
});
