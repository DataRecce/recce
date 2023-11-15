import { VscDiffAdded, VscDiffModified, VscDiffRemoved } from "react-icons/vsc";
import { FaChartBar, FaCube, FaDatabase, FaSeedling } from "react-icons/fa";
import { FaChartSimple, FaCircleNodes, FaGauge } from "react-icons/fa6";
import { TbCube, TbDatabase, TbSeeding } from "react-icons/tb";

export const IconAdded = VscDiffAdded;
export const IconRemoved = VscDiffRemoved;
export const IconModified = VscDiffModified;
export const IconChanged = (props: any) => {
  return (
    <svg
      stroke="currentColor"
      fill="currentColor"
      stroke-width="0"
      viewBox="0 0 16 16"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8 11 a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      />

      <path fill-rule="evenodd" clip-rule="evenodd" d="" />
    </svg>
  );
};

export const IconImpacted = (props: any) => {
  return (
    <svg
      stroke="currentColor"
      fill="currentColor"
      stroke-width="0"
      viewBox="0 0 16 16"
      height="1em"
      width="1em"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M1.5 1 h13 l.5.5 v13 l-.5.5 h-13 l-.5-.5 v-13l.5-.5zM2 2v4h-1v4h1v4h4v1h4v-1h4v-4h1v-4h-1v-4h-4v-1h-4v1h-4z"
      />
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8 11 a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
      />

      <path fill-rule="evenodd" clip-rule="evenodd" d="" />
    </svg>
  );
};

export function getIconForChangeStatus(
  changeStatus?: "added" | "removed" | "modified" | "impacted"
): {
  color: string;
  icon: any; //IconType not provided
} {
  if (changeStatus === "added") {
    return { color: "#1dce00", icon: IconAdded };
  } else if (changeStatus === "removed") {
    return { color: "#ff067e", icon: IconRemoved };
  } else if (changeStatus === "modified") {
    return { color: "#ffa502", icon: IconModified };
  } else if (changeStatus === "impacted") {
    return { color: "#fd6136", icon: IconImpacted };
  }

  return { color: "inherit", icon: undefined };
}

export function getIconForResourceType(resourceType?: string): {
  color: string;
  icon: any; //IconType not provided
} {
  if (resourceType === "model") {
    return { color: "#c0eafd", icon: FaCube };
  } else if (resourceType === "metric") {
    return { color: "#ffe6ee", icon: FaChartSimple };
  } else if (resourceType === "source") {
    return { color: "#a6dda6", icon: FaDatabase };
  } else if (resourceType === "exposure") {
    return { color: "#ffe6ee", icon: FaGauge };
  } else if (resourceType === "semantic_model") {
    return { color: "#fb8caf", icon: FaCircleNodes };
  } else if (resourceType === "seed") {
    return { color: "#a6dda6", icon: FaSeedling };
  } else {
    return { color: "inherit", icon: undefined };
  }
}
