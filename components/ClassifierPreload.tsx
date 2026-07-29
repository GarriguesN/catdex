"use client";

import { useEffect } from "react";
import { preloadClassifier } from "@/lib/classifier";

/** Warms up the coco-ssd detection model as soon as the app opens, so it's
 * (mostly) already loaded by the time the user reaches the capture screen —
 * see lib/classifier.ts for why this matters. */
export function ClassifierPreload() {
  useEffect(() => {
    preloadClassifier();
  }, []);

  return null;
}
