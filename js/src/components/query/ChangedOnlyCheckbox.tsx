import { Checkbox } from "@chakra-ui/react";

interface ChangedOnlyCheckboxProps {
  changedOnly?: boolean;
  onChange: () => void;
}
export const ChangedOnlyCheckbox = ({
  changedOnly,
  onChange,
}: ChangedOnlyCheckboxProps) => {
  return (
    <Checkbox.Root
      size="xs"
      checked={changedOnly}
      onCheckedChange={() => {
        onChange();
      }}
    >
      <Checkbox.HiddenInput />
      <Checkbox.Control />
      <Checkbox.Label>Changed only</Checkbox.Label>
    </Checkbox.Root>
  );
};
