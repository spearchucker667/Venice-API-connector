/**
 * @fileoverview Animated Mio anime mascot component for Character Creator.
 * Uses repository mascot GIF assets with prefers-reduced-motion static fallback.
 */

import { useEffect, useState } from "react";
import mascotAnimated from "../../../assets/mio-xc3-nerdprofeta-gifs/mio-xc3-nerdprofeta-jumping.gif";
import mascotStatic from "../../../assets/mio-xc3-nerdprofeta-gifs/mio-xc3-nerdprofeta-jumping-static.png";

export interface CharacterCreatorMascotProps {
  size?: "nav" | "sm" | "md" | "lg";
  decorative?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CharacterCreatorMascotProps["size"]>, string> = {
  nav: "w-[20px] h-[20px]",
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-16 h-16",
};

export function CharacterCreatorMascot({
  size = "md",
  decorative = true,
  className = "",
}: CharacterCreatorMascotProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const imageSrc = prefersReducedMotion ? mascotStatic : mascotAnimated;
  const sizeClass = SIZE_CLASSES[size];

  return (
    <img
      src={imageSrc}
      alt={decorative ? "" : "Character Creator Mascot"}
      aria-hidden={decorative}
      className={`object-contain bg-transparent shrink-0 ${sizeClass} ${className}`.trim()}
    />
  );
}
