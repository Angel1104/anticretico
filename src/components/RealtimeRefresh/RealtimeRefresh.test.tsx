import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const realtimeChannel: Record<string, unknown> = {};
  const refresh = vi.fn();
  const subscribe = vi.fn(() => realtimeChannel);
  const on = vi.fn(
    (_type: unknown, _filter: unknown, _callback: unknown) => realtimeChannel,
  );
  const channel = vi.fn((_name: string) => realtimeChannel);
  const removeChannel = vi.fn();

  Object.assign(realtimeChannel, { on, subscribe });
  return { channel, on, refresh, removeChannel, subscribe };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.removeChannel,
  },
}));

vi.mock("@/lib/admin/actions", () => ({ releaseEscrow: vi.fn() }));
vi.mock("@/lib/admin/distribute", () => ({ distributeMonthlyRent: vi.fn() }));
vi.mock("@/lib/admin/rollover", () => ({ rolloverHolders: vi.fn() }));

import { RealtimeRefresh } from "./RealtimeRefresh";

describe("RealtimeRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.refresh.mockClear();
    mocks.subscribe.mockClear();
    mocks.on.mockClear();
    mocks.channel.mockClear();
    mocks.removeChannel.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to every change on the public properties table", () => {
    render(<RealtimeRefresh />);

    expect(mocks.channel).toHaveBeenCalledWith("properties-changes");
    expect(mocks.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "properties" },
      expect.any(Function),
    );
    expect(mocks.subscribe).toHaveBeenCalledOnce();
  });

  it("refreshes once 400ms after the latest database event", () => {
    render(<RealtimeRefresh />);
    const handleChange = mocks.on.mock.calls[0][2] as () => void;

    act(() => {
      handleChange();
      vi.advanceTimersByTime(300);
      handleChange();
      vi.advanceTimersByTime(399);
    });
    expect(mocks.refresh).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("removes its channel and cancels a pending refresh on unmount", () => {
    const { unmount } = render(<RealtimeRefresh />);
    const realtimeChannel = mocks.channel.mock.results[0].value;
    const handleChange = mocks.on.mock.calls[0][2] as () => void;

    act(() => handleChange());
    unmount();
    act(() => vi.advanceTimersByTime(400));

    expect(mocks.removeChannel).toHaveBeenCalledWith(realtimeChannel);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("renders no DOM", () => {
    const { container } = render(<RealtimeRefresh />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is exported from the components barrel", async () => {
    const components = await import("../index");
    expect(components.RealtimeRefresh).toBe(RealtimeRefresh);
  });
});
