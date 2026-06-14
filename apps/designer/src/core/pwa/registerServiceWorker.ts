import { usePwaStore } from "@/store/pwaStore";

export async function registerServiceWorker(): Promise<void> {
  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    onNeedRefresh() {
      usePwaStore.getState().setUpdateAvailable(() => {
        void updateSW(true);
      });
    },
  });
}
