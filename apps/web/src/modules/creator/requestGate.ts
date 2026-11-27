export function createRequestGate(timeoutMs = 120000) {
  let current: { controller: AbortController; timer: ReturnType<typeof setTimeout> } | undefined;
  function cancel() {
    const old = current;
    current = undefined;
    if (old) { clearTimeout(old.timer); old.controller.abort(); }
  }
  return {
    cancel,
    start(onTimeout: () => void) {
      if (current) return null;
      const controller = new AbortController();
      const entry = { controller, timer: setTimeout(() => {
        if (current !== entry) return;
        cancel();
        onTimeout();
      }, timeoutMs) };
      current = entry;
      return {
        signal: controller.signal,
        isCurrent: () => current === entry,
        finish() { if (current !== entry) return false; clearTimeout(entry.timer); current = undefined; return true; }
      };
    }
  };
}
