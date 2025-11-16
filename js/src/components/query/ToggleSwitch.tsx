import { Button, ButtonGroup } from "@chakra-ui/react";
import { DiffText } from "./DiffText";

interface ToggleSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  textOn?: string;
  textOff?: string;
}
export const ToggleSwitch = ({
  value,
  onChange,
  textOn,
  textOff,
}: ToggleSwitchProps) => {
  return (
    <ButtonGroup attached variant="outline" borderRadius="full" size="xs">
      <Button
        onClick={() => {
          onChange(false);
        }}
        color={!value ? "black" : "gray.400"}
        bg={!value ? "white" : "gray.50"}
      >
        {textOff ?? "Off"}
      </Button>
      <Button
        onClick={() => {
          onChange(true);
        }}
        color={value ? "black" : "gray.400"}
        bg={value ? "white" : "gray.50"}
      >
        {textOn ?? "On"}
      </Button>
    </ButtonGroup>
  );
};

interface DiffDislayModeSwitchProps {
  displayMode: "inline" | "side_by_side";
  onDisplayModeChanged: (displayMode: "inline" | "side_by_side") => void;
}

export const DiffDisplayModeSwitch = ({
  displayMode,
  onDisplayModeChanged,
}: DiffDislayModeSwitchProps) => {
  return (
    <>
      {displayMode === "inline" && (
        <>
          <DiffText
            value="Base"
            colorPalette="red"
            grayOut={false}
            fontSize="10pt"
            noCopy
          />
          <DiffText
            value="Current"
            colorPalette="green"
            grayOut={false}
            fontSize="10pt"
            noCopy
          />
        </>
      )}
      <ToggleSwitch
        value={displayMode === "side_by_side"}
        onChange={(value) => {
          onDisplayModeChanged(value ? "side_by_side" : "inline");
        }}
        textOff="Inline"
        textOn="Side by side"
      />
    </>
  );
};
