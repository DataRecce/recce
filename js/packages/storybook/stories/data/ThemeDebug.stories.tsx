// Debug story to test theme detection
import { useIsDark } from "@datarecce/ui/hooks";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";

function ThemeDebugger() {
  const isDark = useIsDark();
  const [hasClass, setHasClass] = useState(false);

  useEffect(() => {
    const checkClass = () => {
      setHasClass(document.documentElement.classList.contains("dark"));
    };
    checkClass();

    const observer = new MutationObserver(checkClass);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div style={{ padding: "20px", fontFamily: "monospace" }}>
      <h2>Theme Detection Debug</h2>
      <div style={{ marginTop: "20px", fontSize: "16px" }}>
        <div style={{ marginBottom: "10px" }}>
          <strong>useIsDark() hook returns:</strong>{" "}
          <span style={{ color: isDark ? "green" : "red", fontWeight: "bold" }}>
            {String(isDark)}
          </span>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <strong>document.documentElement has .dark class:</strong>{" "}
          <span
            style={{ color: hasClass ? "green" : "red", fontWeight: "bold" }}
          >
            {String(hasClass)}
          </span>
        </div>
        <div style={{ marginBottom: "10px" }}>
          <strong>document.documentElement.className:</strong>{" "}
          {document.documentElement.className || "(empty)"}
        </div>
      </div>
      <div style={{ marginTop: "30px", padding: "20px", border: "2px solid" }}>
        <p>
          Toggle the theme using the paintbrush icon in Storybook's toolbar and
          watch the values above.
        </p>
        <p>
          Expected behavior: Both values should be <code>true</code> when dark
          mode is selected.
        </p>
      </div>
    </div>
  );
}

const meta: Meta<typeof ThemeDebugger> = {
  title: "Debug/Theme Detection",
  component: ThemeDebugger,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ThemeDebugger>;

export const Default: Story = {};
