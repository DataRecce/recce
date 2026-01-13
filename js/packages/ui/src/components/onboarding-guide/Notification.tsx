import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import MuiLink from "@mui/material/Link";
import { PropsWithChildren } from "react";
import { FiInfo } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import { LuExternalLink } from "react-icons/lu";

export const RecceNotification = (
  props: PropsWithChildren<{
    onClose: () => void;
    align?: string;
  }>,
) => {
  return (
    <Box
      sx={{
        display: "flex",
        flex: 1,
        minHeight: "48px",
        m: "4px",
        px: "16px",
        py: "12px",
        bgcolor: "primary.50",
        border: "1px solid",
        borderRadius: "4px",
        borderColor: "primary.400",
        alignItems: props.align ?? "center",
        gap: "12px",
      }}
    >
      <Box
        component={FiInfo}
        sx={{ width: "20px", height: "20px", color: "primary.900" }}
      />
      {props.children}
      <Box sx={{ flexGrow: 1 }} />
      <IconButton size="small" onClick={props.onClose}>
        <IoClose />
      </IconButton>
    </Box>
  );
};

export const LearnHowLink = () => {
  return (
    <MuiLink
      href="https://docs.datarecce.io/get-started/#prepare-dbt-artifacts"
      target="_blank"
      sx={{
        color: "primary.main",
        fontWeight: "bold",
        textDecoration: "underline",
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
      }}
    >
      Learn how <LuExternalLink />
    </MuiLink>
  );
};
