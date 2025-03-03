"use client";
export function getLocationHash() {
  if (typeof window !== "undefined") {
    return window.location.hash.replace("#", "");
  }
}

export function setLocationHash(hash: string) {
  if (typeof window !== "undefined") {
    window.location.hash = hash;
  }
}
