import { ButtonGroup, Button } from "@chakra-ui/react";

interface ToggleSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  textOn?: string;
  textOff?: string;
}
export const ToggleSwitch = ({ value, onChange, textOn, textOff }: ToggleSwitchProps) => {
  return (
    <ButtonGroup isAttached variant="outline" borderRadius="full" size={"xs"}>
      <Button
        onClick={() => {
          onChange(false);
        }}
        color={!value ? "black" : "gray.400"}
        bg={!value ? "white" : "gray.50"}>
        {textOff ?? "Off"}
      </Button>
      <Button
        onClick={() => {
          onChange(true);
        }}
        color={value ? "black" : "gray.400"}
        bg={value ? "white" : "gray.50"}>
        {textOn ?? "On"}
      </Button>
    </ButtonGroup>
  );
};
