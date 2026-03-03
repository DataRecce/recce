"use client";

/**
 * MUI Theme - OSS Semantic Colors
 *
 * @deprecated For theme imports, use @datarecce/ui/theme directly:
 * - `import { theme, token, colors, semanticVariantMap } from "@datarecce/ui/theme";`
 *
 * This module only contains OSS-specific semantic colors for
 * base/current environment comparison UI.
 */

import { colors } from "../../theme";

/**
 * Semantic color tokens for environment identification
 * These are specific to Recce OSS for the base/current environment comparison UI
 */
export const semanticColors = {
  envBase: colors.amber[500],
  envCurrent: colors.iochmara[500],
};
