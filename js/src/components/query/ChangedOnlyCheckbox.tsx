import { Checkbox } from "@chakra-ui/react";

interface ChangedOnlyCheckboxProps {
  changedOnly?: boolean;
  onChange: () => void;
}
export const ChangedOnlyCheckbox = ({ changedOnly, onChange }: ChangedOnlyCheckboxProps) => {
  return (
    <Checkbox
      size="xs"
      isChecked={changedOnly}
      onChange={() => {
        onChange();
      }}>
      Changed only
    </Checkbox>
  );
};
