// src/components/GlobalNumberWheelBlocker.jsx
import { useEffect } from "react";

export default function GlobalNumberWheelBlocker() {
  useEffect(() => {
    const onWheelCapture = (e) => {
      // climb up in case the event target is inside a styled wrapper
      let el = e.target;
      while (el && el !== document.body) {
        if (
          el.tagName === "INPUT" &&
          (el.getAttribute("type") || "").toLowerCase() === "number"
        ) {
          // Do NOT preventDefault — just drop focus so the input won't step.
          el.blur();
          break;
        }
        el = el.parentElement;
      }
    };

    // Capture phase so we run before the input’s default stepping
    document.addEventListener("wheel", onWheelCapture, { capture: true });
    return () =>
      document.removeEventListener("wheel", onWheelCapture, { capture: true });
  }, []);

  return null;
}
