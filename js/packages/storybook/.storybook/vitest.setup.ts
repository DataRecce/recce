import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock react-syntax-highlighter to avoid ESM/CJS issues
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));
