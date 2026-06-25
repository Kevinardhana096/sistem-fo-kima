import { useEffect } from "react";

let globalLockCount = 0;
let originalOverflow = "";
let originalPaddingRight = "";

export function useScrollLock(isLocked) {
  useEffect(() => {
    if (!isLocked) return;

    if (globalLockCount === 0) {
      // Store original styles
      originalOverflow = window.getComputedStyle(document.body).overflow;
      originalPaddingRight = document.body.style.paddingRight;

      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      
      document.body.style.overflow = "hidden";
    }
    globalLockCount++;

    return () => {
      globalLockCount--;
      if (globalLockCount <= 0) {
        globalLockCount = 0;
        document.body.style.overflow = originalOverflow === "hidden" ? "" : originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      }
    };
  }, [isLocked]);
}
