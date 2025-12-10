"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the window width is <= breakpoint, false if wider,
 * and null on the very first server render before we know the size.
 */
export function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const check = () => {
      setIsMobile(window.innerWidth <= breakpoint);
    };

    check(); // run once on mount
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);

  return isMobile;
}
