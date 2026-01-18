import "@testing-library/jest-dom/vitest";
import { setProjectAnnotations } from "@storybook/react";
import { beforeAll, vi } from "vitest";

// Import preview annotations for Storybook integration
import * as previewAnnotations from "./preview";

// Set up Storybook project annotations for portable stories
const project = setProjectAnnotations([previewAnnotations]);

// Run Storybook's beforeAll hook
beforeAll(project.beforeAll);

// Mock react-syntax-highlighter to avoid ESM/CJS issues
vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));
