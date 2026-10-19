import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAvatarStore } from "../src/store/avatar";

describe("REQ-025 3D 数字人状态联动", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });

  afterEach(() => vi.useRealTimers());

  it("讲解时产生口型，完成后回到待机", () => {
    const avatar = useAvatarStore();
    avatar.simulateSpeaking("欢迎来到灵山");
    expect(avatar.state).toBe("speaking");
    vi.advanceTimersByTime(110);
    expect(avatar.mouthOpen).toBeGreaterThan(0);
    vi.advanceTimersByTime(5000);
    expect(avatar.state).toBe("idle");
    expect(avatar.mouthOpen).toBe(0);
  });

  it("切换到思考会停止旧讲解计时器，不会被过期回调改回待机", () => {
    const avatar = useAvatarStore();
    avatar.simulateSpeaking("第一段讲解");
    vi.advanceTimersByTime(220);
    avatar.setState("thinking");
    expect(avatar.mouthOpen).toBe(0);
    vi.advanceTimersByTime(6000);
    expect(avatar.state).toBe("thinking");
  });
});
