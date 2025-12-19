import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import React from "react";
import { TbChecklist, TbPlus } from "react-icons/tb";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { Check } from "@/lib/api/checks";
import { createSchemaDiffCheck } from "@/lib/api/schemacheck";
import { useAppLocation } from "@/lib/hooks/useAppRouter";

export const CheckEmptyState = () => {
  const queryClient = useQueryClient();
  const [, setLocation] = useAppLocation();

  const { mutate: createSchemaCheck, isPending } = useMutation({
    mutationFn: () => createSchemaDiffCheck({ select: "state:modified" }),
    onSuccess: async (check: Check) => {
      await queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
      setLocation(`/checks/?id=${check.check_id}`);
    },
  });

  const handleCreateSchemaCheck = () => {
    createSchemaCheck();
  };

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack
        spacing={3}
        sx={{ textAlign: "center", maxWidth: "400px", alignItems: "center" }}
      >
        <Box component={TbChecklist} sx={{ fontSize: 64, color: "grey.400" }} />

        <Stack spacing={1}>
          <Typography variant="h5" sx={{ color: "grey.600" }}>
            No checks yet
          </Typography>
          <Typography sx={{ color: "grey.500" }}>
            Checks help you validate data quality and catch issues.
          </Typography>
        </Stack>

        <Stack spacing={1.5} sx={{ width: "100%" }}>
          <Typography
            sx={{ fontSize: "0.875rem", color: "grey.600", fontWeight: 500 }}
          >
            Get started with your first check:
          </Typography>

          <Button
            color="iochmara"
            variant="contained"
            onClick={handleCreateSchemaCheck}
            disabled={isPending}
            size="large"
            fullWidth
            startIcon={<TbPlus />}
          >
            Create Schema Diff Check
          </Button>

          <Typography sx={{ fontSize: "0.75rem", color: "grey.400", mt: 0.5 }}>
            The schema checks compare modified models between environments to
            detect changes, additions, or removals.
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
};
