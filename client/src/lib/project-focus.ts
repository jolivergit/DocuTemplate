/** Restore the inline editor's initiating control after React commits its return view. */
export function focusProjectControl(selector: string) {
  requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
}
