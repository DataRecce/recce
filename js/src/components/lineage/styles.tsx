import React from "react";
import { FaCamera, FaCube, FaDatabase, FaSeedling } from "react-icons/fa";
import { FaChartSimple, FaCircleNodes, FaGauge } from "react-icons/fa6";
import { VscDiffAdded, VscDiffModified, VscDiffRemoved } from "react-icons/vsc";
import { system as themeSystem } from "@/components/ui/theme";

export const IconAdded = VscDiffAdded;
export const IconRemoved = VscDiffRemoved;
export const IconModified = VscDiffModified;
export const IconChanged = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      viewBox="0 0 16 16"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 11 a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      />

      <path fillRule="evenodd" clipRule="evenodd" d="" />
    </svg>
  );
};

export const IconModifiedDownstream = (
  props: React.SVGProps<SVGSVGElement>,
) => {
  return (
    <svg
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      viewBox="0 0 16 16"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.5 1 h13 l.5.5 v13 l-.5.5 h-13 l-.5-.5 v-13l.5-.5zM2 2v4h-1v4h1v4h4v1h4v-1h4v-4h1v-4h-1v-4h-4v-1h-4v1h-4z"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 11 a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      />

      <path fillRule="evenodd" clipRule="evenodd" d="" />
    </svg>
  );
};

export function getIconForChangeStatus(
  changeStatus?: "added" | "removed" | "modified",
): {
  color: string;
  hexColor: string;
  backgroundColor: string;
  hexBackgroundColor: string;
  icon: typeof IconAdded | undefined;
} {
  if (changeStatus === "added") {
    return {
      color: "green.solid",
      hexColor: String(themeSystem.token("colors.green.solid")),
      backgroundColor: "green.subtle",
      hexBackgroundColor: String(themeSystem.token("colors.green.subtle")),
      icon: IconAdded,
    };
  } else if (changeStatus === "removed") {
    return {
      color: "red.solid",
      hexColor: String(themeSystem.token("colors.red.solid")),
      backgroundColor: "red.subtle",
      hexBackgroundColor: String(themeSystem.token("colors.red.subtle")),
      icon: IconRemoved,
    };
  } else if (changeStatus === "modified") {
    return {
      color: "orange.emphasized",
      hexColor: String(themeSystem.token("colors.orange.emphasized")),
      backgroundColor: "orange.subtle",
      hexBackgroundColor: String(themeSystem.token("colors.orange.subtle")),
      icon: IconModified,
    };
  }

  return {
    color: "gray.focusRing",
    hexColor: String(themeSystem.token("colors.gray.focusRing")),
    backgroundColor: "white",
    hexBackgroundColor: String(themeSystem.token("colors.white")),
    icon: undefined,
  };
}

export function getIconForResourceType(resourceType?: string): {
  color: string;
  icon: typeof FaCube | undefined;
} {
  if (resourceType === "model") {
    return {
      color: String(themeSystem.token("colors.cyan.subtle")),
      icon: FaCube,
    };
  } else if (resourceType === "metric") {
    return {
      color: String(themeSystem.token("colors.rose.subtle")),
      icon: FaChartSimple,
    };
  } else if (resourceType === "source") {
    return {
      color: String(themeSystem.token("colors.green.muted")),
      icon: FaDatabase,
    };
  } else if (resourceType === "exposure") {
    return {
      color: String(themeSystem.token("colors.rose.subtle")),
      icon: FaGauge,
    };
  } else if (resourceType === "semantic_model") {
    return {
      color: String(themeSystem.token("colors.rose.focusRing")),
      icon: FaCircleNodes,
    };
  } else if (resourceType === "seed") {
    return {
      color: String(themeSystem.token("colors.green.emphasized")),
      icon: FaSeedling,
    };
  } else if (resourceType === "snapshot") {
    return {
      color: String(themeSystem.token("colors.green.emphasized")),
      icon: FaCamera,
    };
  } else {
    return { color: "inherit", icon: undefined };
  }
}
