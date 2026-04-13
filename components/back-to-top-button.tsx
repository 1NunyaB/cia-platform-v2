"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 240);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="fixed bottom-4 left-4 z-50 border-border bg-card/95 text-foreground shadow-sm backdrop-blur"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
    >
      Back to top
    </Button>
  );
}

