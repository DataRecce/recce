"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { useState } from "react";
import { MdWarningAmber } from "react-icons/md";
import { useRecceInstanceContext } from "../../contexts";

const SESSION_KEY = "recce-python-deprecation-dismissed";

export function PythonDeprecationModal() {
  const { pythonVersion } = useRecceInstanceContext();
  const [dismissed, setDismissed] = useState(
    () =>
      typeof window !== "undefined" &&
      sessionStorage.getItem(SESSION_KEY) === "true",
  );

  const shouldShow =
    !dismissed &&
    typeof pythonVersion === "string" &&
    pythonVersion.startsWith("3.9");

  if (!shouldShow) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setDismissed(true);
  };

  return (
    <Dialog open onClose={handleDismiss}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <MdWarningAmber
          style={{ color: "rgb(237 108 2)", fontSize: "1.5rem" }}
        />
        Python 3.9 Deprecation Notice
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Python 3.9 support will be removed in a future release of Recce.
          Please upgrade to Python 3.10 or later to continue receiving updates.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleDismiss} variant="contained">
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  );
}
