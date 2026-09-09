import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ single: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseAdmin: () => {
  const chain = { select: () => chain, eq: () => chain, single: mocks.single };
  return { from: () => chain };
} }));
import { setMetaCampaignStatus } from "@/lib/meta/ads";
const reply = (data: unknown) => ({ ok: true, json: async () => data });
describe("Meta campaign writes", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch);
    vi.stubEnv("META_APP_ID", "test-app"); vi.stubEnv("META_APP_SECRET", "test-secret"); vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.diced.com.br");
    mocks.single.mockResolvedValue({ data: { access_token: "test-token", token_expiry: null } });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it("refuses an account mismatch before any write", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ account_id: "999", status: "ACTIVE" }));
    await expect(setMetaCampaignStatus("owner", "456", "123", "PAUSED", "ACTIVE")).rejects.toThrow("conta vinculada");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it("requires ads_management and does not mutate with a read-only token", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ account_id: "456", status: "ACTIVE" })).mockResolvedValueOnce(reply({ data: [{ permission: "ads_read", status: "granted" }] }));
    await expect(setMetaCampaignStatus("owner", "456", "123", "PAUSED", "ACTIVE")).rejects.toThrow("Reconecte");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
  it("posts only status and verifies the returned campaign", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ account_id: "456", status: "ACTIVE" }))
      .mockResolvedValueOnce(reply({ data: [{ permission: "ads_management", status: "granted" }] }))
      .mockResolvedValueOnce(reply({ success: true }))
      .mockResolvedValueOnce(reply({ account_id: "456", status: "PAUSED" }));
    expect((await setMetaCampaignStatus("owner", "456", "123", "PAUSED", "ACTIVE")).status).toBe("PAUSED");
    const options = mocks.fetch.mock.calls[2]![1];
    expect(options.method).toBe("POST");
    expect([...options.body.keys()].sort()).toEqual(["access_token", "appsecret_proof", "status"]);
    expect(options.body.get("status")).toBe("PAUSED");
  });
  it("does not repeat a write when the requested state already exists", async () => {
    mocks.fetch.mockResolvedValueOnce(reply({ account_id: "456", status: "PAUSED" }));
    expect((await setMetaCampaignStatus("owner", "456", "123", "PAUSED", "ACTIVE")).status).toBe("PAUSED");
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
