import { defineStore } from "pinia";

export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "happy" | "concerned" | "error";

let speakingTimer: ReturnType<typeof setInterval> | undefined;

function stopSpeakingTimer() {
  if (speakingTimer !== undefined) clearInterval(speakingTimer);
  speakingTimer = undefined;
}

export const useAvatarStore = defineStore("avatar", {
  state: () => ({
    state: "idle" as AvatarState,
    mouthOpen: 0,
    emotion: "smile",
    caption: "您好，我是灵灵，正在为您守候。"
  }),
  actions: {
    setState(state: AvatarState) {
      stopSpeakingTimer();
      this.state = state;
      this.mouthOpen = 0;
      this.emotion = state === "concerned" || state === "error" ? "concerned" : state === "thinking" ? "thinking" : "smile";
    },
    simulateSpeaking(text = "") {
      stopSpeakingTimer();
      this.state = "speaking";
      this.emotion = "smile";
      this.caption = text || "灵灵正在讲解。";
      let tick = 0;
      const maxTicks = Math.min(60, Math.max(20, Math.ceil(this.caption.length / 3)));
      speakingTimer = setInterval(() => {
        tick += 1;
        this.mouthOpen = tick % 3 === 0 ? 1 : tick % 3 === 1 ? 0.45 : 0.15;
        if (tick > maxTicks) {
          stopSpeakingTimer();
          this.mouthOpen = 0;
          this.state = "idle";
          this.caption = "您还可以继续问我路线、历史、拍照点或服务设施。";
        }
      }, 110);
    }
  }
});
