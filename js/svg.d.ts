/**
 * SVG module type declarations
 *
 * This file tells TypeScript how to handle SVG imports.
 * SVGs imported as modules can be used as React components or static image data.
 */

declare module "*.svg" {
  import { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}

declare module "*.svg?url" {
  const content: string;
  export default content;
}
