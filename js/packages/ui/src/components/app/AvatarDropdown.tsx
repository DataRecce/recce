import MuiAvatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useQuery } from "@tanstack/react-query";
import { type MouseEvent, useState } from "react";
import { FaCloud, FaUser } from "react-icons/fa";
import { cacheKeys } from "../../api";
import { useApiConfig } from "../../hooks";
import { fetchGitHubAvatar, fetchUser } from "../../lib/api/user";
import { RECCE_SUPPORT_CALENDAR_URL } from "../../lib/const";

export default function AvatarDropdown() {
  const { apiClient } = useApiConfig();
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: cacheKeys.user(),
    queryFn: () => fetchUser(apiClient),
    retry: false,
  });

  const { data: avatarUrl } = useQuery({
    queryKey: ["github-avatar", user?.id],
    queryFn: () => (user ? fetchGitHubAvatar(user.id) : Promise.resolve(null)),
    enabled: !!user?.id && user.login_type === "github",
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const showUserInfo = !isLoading && !error && user;

  // Get initials for avatar fallback
  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };

  return (
    <>
      {isLoading ? (
        <Box
          onClick={handleClick}
          sx={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            bgcolor: "background.paper",
            color: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <CircularProgress size={16} />
        </Box>
      ) : (
        <MuiAvatar
          onClick={handleClick}
          src={avatarUrl || undefined}
          sx={{
            width: 28,
            height: 28,
            cursor: "pointer",
            outline: "1px solid white",
            fontSize: "0.875rem",
          }}
        >
          {getInitials(user?.login)}
        </MuiAvatar>
      )}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              bgcolor: "background.paper",
              borderColor: "divider",
              boxShadow: 3,
              minWidth: 180,
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          {isLoading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" color="text.primary">
                Loading...
              </Typography>
              <CircularProgress size={16} />
            </Box>
          )}
          {error && (
            <Typography variant="caption" color="error">
              Failed to load user information
            </Typography>
          )}
          {showUserInfo && (
            <>
              <Typography variant="body2" fontWeight="600" color="text.primary">
                {user.login}
              </Typography>
              {user.email && (
                <Typography variant="caption" color="text.secondary">
                  {user.email}
                </Typography>
              )}
            </>
          )}
        </Box>
        <Divider />
        <MenuItem
          onClick={() => {
            window.open("https://cloud.datarecce.io/", "_blank");
            handleClose();
          }}
        >
          <ListItemIcon>
            <FaCloud />
          </ListItemIcon>
          <ListItemText>Recce Cloud</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            window.open(RECCE_SUPPORT_CALENDAR_URL, "_blank");
            handleClose();
          }}
        >
          <ListItemIcon>
            <FaUser />
          </ListItemIcon>
          <ListItemText>Get live support</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
