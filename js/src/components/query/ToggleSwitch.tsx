import { DiffText } from "@datarecce/ui/components/ui";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";

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
    <ButtonGroup variant="outlined" size="xsmall" sx={{ borderRadius: 1 }}>
      <Button
        onClick={() => {
          onChange(false);
        }}
        sx={{
          color: !value ? "black" : "grey.400",
          bgcolor: !value ? "white" : "grey.50",
        }}
      >
        {textOff ?? "Off"}
      </Button>
      <Button
        onClick={() => {
          onChange(true);
        }}
        sx={{
          color: value ? "black" : "grey.400",
          bgcolor: value ? "white" : "grey.50",
        }}
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
