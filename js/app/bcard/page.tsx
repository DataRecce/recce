"use client";
import { useState } from "react";
import { colors } from "@/components/ui/mui-theme";

type CardStyle = "dark" | "light" | "brand";
interface CardStyleProps {
  bg: string;
  text: string;
  accent: string;
  subtle: string;
}

export default function BusinessCard() {
  const [isFlipped, setIsFlipped] = useState(false);
  const [cardStyle, setCardStyle] = useState<CardStyle>("dark");

  const styles: Record<CardStyle, CardStyleProps> = {
    dark: {
      bg: `linear-gradient(135deg, ${colors.iochmara[950]} 0%, ${colors.iochmara[900]} 50%, ${colors.iochmara[800]} 100%)`,
      text: colors.white,
      accent: colors.brand[500],
      subtle: colors.iochmara[700],
    },
    light: {
      bg: colors.neutral[50],
      text: colors.neutral[900],
      accent: colors.brand[500],
      subtle: colors.neutral[200],
    },
    brand: {
      bg: `linear-gradient(135deg, ${colors.brand[700]} 0%, ${colors.brand[500]} 100%)`,
      text: colors.white,
      accent: colors.white,
      subtle: colors.brand[400],
    },
  };

  const current = styles[cardStyle];
  const isLight = cardStyle === "light";

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center justify-center">
      <div className="mb-6 flex gap-2">
        {Object.keys(styles).map((style) => (
          <button
            key={style}
            onClick={() => setCardStyle(style as CardStyle)}
            className={`px-4 py-2 rounded-lg capitalize text-sm font-medium transition-all ${
              cardStyle === style
                ? "text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            style={cardStyle === style ? { background: colors.brand[500] } : {}}
          >
            {style}
          </button>
        ))}
      </div>

      <div
        className="relative cursor-pointer"
        style={{ perspective: "1000px", width: "400px", height: "240px" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="absolute w-full h-full transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front of Card */}
          <div
            className="absolute w-full h-full rounded-2xl shadow-2xl overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              background: current.bg,
            }}
          >
            <div className="relative h-full p-7 flex flex-col justify-between">
              {/* Decorative accent line */}
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ background: current.accent }}
              />

              {/* Decorative circle */}
              <div
                className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full"
                style={{
                  background: current.subtle,
                  opacity: isLight ? 0.3 : 0.15,
                }}
              />

              {/* Logo & Company */}
              <div className="relative z-10">
                <div className="flex items-center gap-3">
                  <img
                    src="/logo/recce-logo-white.png"
                    alt="Recce"
                    className="w-11 h-11"
                    style={{
                      filter: isLight ? "invert(1)" : "none",
                    }}
                  />
                  <div>
                    <h1
                      className="text-2xl tracking-tight"
                      style={{
                        color: current.text,
                        fontFamily:
                          'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                        fontWeight: 700,
                      }}
                    >
                      Recce
                    </h1>
                  </div>
                </div>
              </div>

              {/* Tagline */}
              <div className="relative z-10">
                <p
                  className="text-base font-medium leading-snug"
                  style={{ color: current.text, opacity: 0.9 }}
                >
                  Data validation for data engineers
                </p>
                <p className="text-sm mt-1" style={{ color: current.accent }}>
                  Know your impact before you merge
                </p>
              </div>

              {/* Contact Info */}
              <div className="relative z-10">
                <h2
                  className="text-lg font-semibold"
                  style={{ color: current.text }}
                >
                  Jared Scott
                </h2>
                <p
                  className="text-sm"
                  style={{ color: current.text, opacity: 0.7 }}
                >
                  Software Engineer
                </p>
              </div>
            </div>
          </div>

          {/* Back of Card */}
          <div
            className="absolute w-full h-full rounded-2xl shadow-2xl overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: isLight ? colors.neutral[100] : current.bg,
            }}
          >
            <div className="relative h-full p-7 flex flex-col justify-between">
              {/* Accent line */}
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ background: current.accent }}
              />

              {/* Logo small */}
              <div className="relative z-10 flex items-center gap-2">
                <img
                  src="/logo/recce-logo-white.png"
                  alt="Recce"
                  className="w-8 h-8"
                  style={{
                    filter: isLight ? "invert(1)" : "none",
                  }}
                />
                <span
                  style={{
                    color: current.text,
                    fontFamily:
                      'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"',
                    fontWeight: 600,
                  }}
                >
                  Recce
                </span>
              </div>

              {/* Contact Details */}
              <div className="relative z-10 flex justify-between items-end">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{
                        background: isLight
                          ? colors.neutral[200]
                          : "rgba(255,255,255,0.1)",
                        color: current.text,
                      }}
                    >
                      ✉
                    </div>
                    <span className="text-sm" style={{ color: current.text }}>
                      jared.scott@reccehq.com
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{
                        background: isLight
                          ? colors.neutral[200]
                          : "rgba(255,255,255,0.1)",
                        color: current.text,
                      }}
                    >
                      in
                    </div>
                    <span className="text-sm" style={{ color: current.text }}>
                      linkedin.com/in/jaredmscott
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                      style={{
                        background: isLight
                          ? colors.neutral[200]
                          : "rgba(255,255,255,0.1)",
                        color: current.text,
                      }}
                    >
                      ◎
                    </div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: current.accent }}
                    >
                      reccehq.com
                    </span>
                  </div>
                </div>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{
                    background: colors.white,
                    padding: "4px",
                  }}
                >
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=https://linkedin.com/in/jaredmscott&color=0A0A0A"
                    alt="LinkedIn QR"
                    className="w-16 h-16"
                  />
                </div>
              </div>

              {/* Bottom tagline */}
              <div className="relative z-10">
                <p
                  className="text-xs"
                  style={{ color: current.text, opacity: 0.6 }}
                >
                  Validate · Compare · Ship
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Click card to flip • Standard 3.5" × 2" size
      </p>

      {/* Specs */}
      <div className="mt-8 bg-white rounded-xl p-4 shadow-sm max-w-md w-full">
        <h3 className="font-semibold text-gray-800 mb-3">Brand Colors Used</h3>
        <div className="flex gap-2 mb-4">
          <div className="flex flex-col items-center">
            <div
              className="w-10 h-10 rounded-lg shadow-sm"
              style={{ background: colors.brand[500] }}
            />
            <span className="text-xs text-gray-500 mt-1">Brand</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-10 h-10 rounded-lg shadow-sm"
              style={{ background: colors.iochmara[900] }}
            />
            <span className="text-xs text-gray-500 mt-1">Dark</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-10 h-10 rounded-lg shadow-sm"
              style={{ background: colors.iochmara[800] }}
            />
            <span className="text-xs text-gray-500 mt-1">Navy</span>
          </div>
          <div className="flex flex-col items-center">
            <div
              className="w-10 h-10 rounded-lg shadow-sm border"
              style={{ background: colors.neutral[50] }}
            />
            <span className="text-xs text-gray-500 mt-1">Light</span>
          </div>
        </div>
        <h3 className="font-semibold text-gray-800 mb-2">Print Specs</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Size: 3.5" × 2" (standard)</li>
          <li>• Bleed: 0.125" all sides</li>
          <li>• Resolution: 300 DPI</li>
          <li>• Color: CMYK for print</li>
        </ul>
      </div>
    </div>
  );
}
