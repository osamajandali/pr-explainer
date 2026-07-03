import { interpolate, spring } from "remotion";

/** Opacity that fades in at the start and out at the end of a scene. */
export function fadeInOut(
  frame: number,
  durationInFrames: number,
  fade = 15,
): number {
  const fadeIn = interpolate(frame, [0, fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fade, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return Math.min(fadeIn, fadeOut);
}

/** Eased 0→1 entrance value, optionally delayed. */
export function enter(
  frame: number,
  fps: number,
  delay = 0,
  damping = 200,
): number {
  return spring({
    frame: frame - delay,
    fps,
    config: { damping, mass: 0.6 },
    durationInFrames: 30,
  });
}

/** Slide-up transform string driven by an entrance value. */
export function riseUp(value: number, distance = 40): string {
  return `translateY(${(1 - value) * distance}px)`;
}
