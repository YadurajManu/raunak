export function cameraGuidance(error: unknown): {
  title: string;
  message: string;
} {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        title: "Camera access is blocked",
        message:
          "Allow Camera in your browser’s site settings, then try again. On iPhone, check Safari’s website camera permission. In an in-app browser, open this page in Safari or Chrome. Manual lookup still works.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        title: "No camera found",
        message:
          "Connect a camera or use another device. You can still find a guest by name, email, mobile number or ticket code.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        title: "Camera is busy",
        message:
          "Close other camera apps and browser tabs, then retry. If it stays busy, use manual lookup while you restart the browser.",
      };
    case "OverconstrainedError":
      return {
        title: "That camera is unavailable",
        message: "Choose the default camera or another camera, then retry.",
      };
    case "SecurityError":
      return {
        title: "Use a secure browser page",
        message:
          "Open Raunak directly over HTTPS in Safari or Chrome to use the camera. Manual lookup is available below.",
      };
    default:
      return {
        title: "Camera could not start",
        message:
          "Retry or choose another camera. Check browser permissions and lighting, or find the guest manually below.",
      };
  }
}
