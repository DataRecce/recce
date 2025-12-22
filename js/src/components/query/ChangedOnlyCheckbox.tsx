import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";

interface ChangedOnlyCheckboxProps {
  changedOnly?: boolean;
  onChange: () => void;
}
export const ChangedOnlyCheckbox = ({
  changedOnly,
  onChange,
}: ChangedOnlyCheckboxProps) => {
  return (
    <FormControlLabel
      control={
        <Checkbox
          checked={changedOnly ?? false}
          onChange={() => {
            onChange();
          }}
          size="small"
        />
      }
      label="Changed only"
      slotProps={{
        typography: { variant: "body2" },
      }}
    />
  );
};
