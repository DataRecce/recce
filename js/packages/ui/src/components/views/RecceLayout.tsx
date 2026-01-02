"use client";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { memo, type ReactNode } from "react";

/**
 * Navigation item for the sidebar
 */
export interface NavItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Optional badge content */
  badge?: string | number;
}

/**
 * Props for the RecceLayout component.
 * Defines the shell layout with navigation.
 */
export interface RecceLayoutProps {
  /**
   * Navigation items for the sidebar.
   */
  navItems: NavItem[];

  /**
   * Currently active navigation item ID.
   */
  activeNavId?: string;

  /**
   * Callback when a navigation item is clicked.
   */
  onNavClick?: (navId: string) => void;

  /**
   * Main content area.
   */
  children: ReactNode;

  /**
   * Optional header/toolbar content.
   */
  headerContent?: ReactNode;

  /**
   * Optional footer content.
   */
  footerContent?: ReactNode;

  /**
   * Application title in the header.
   * @default "Recce"
   */
  title?: string;

  /**
   * Logo element to display in header.
   */
  logo?: ReactNode;

  /**
   * Actions to display in the header (right side).
   */
  headerActions?: ReactNode;

  /**
   * Width of the sidebar in pixels.
   * @default 240
   */
  sidebarWidth?: number;

  /**
   * Whether to show the header.
   * @default true
   */
  showHeader?: boolean;

  /**
   * Whether to show the sidebar.
   * @default true
   */
  showSidebar?: boolean;

  /**
   * Whether sidebar is collapsed (icon-only mode).
   * @default false
   */
  sidebarCollapsed?: boolean;

  /**
   * Width of collapsed sidebar in pixels.
   * @default 64
   */
  collapsedSidebarWidth?: number;

  /**
   * Callback to toggle sidebar collapsed state.
   */
  onSidebarToggle?: () => void;

  /**
   * Optional CSS class name.
   */
  className?: string;
}

/**
 * RecceLayout Component
 *
 * A high-level shell component that provides the standard Recce layout
 * with a header, sidebar navigation, and main content area.
 *
 * @example Basic usage
 * ```tsx
 * import { RecceLayout } from '@datarecce/ui';
 * import { LineageIcon, CheckIcon, QueryIcon } from './icons';
 *
 * function App() {
 *   const [activeNav, setActiveNav] = useState('lineage');
 *
 *   return (
 *     <RecceLayout
 *       title="My Recce App"
 *       navItems={[
 *         { id: 'lineage', label: 'Lineage', icon: <LineageIcon /> },
 *         { id: 'checks', label: 'Checks', icon: <CheckIcon /> },
 *         { id: 'query', label: 'Query', icon: <QueryIcon /> },
 *       ]}
 *       activeNavId={activeNav}
 *       onNavClick={setActiveNav}
 *     >
 *       {activeNav === 'lineage' && <LineageView />}
 *       {activeNav === 'checks' && <ChecksView />}
 *       {activeNav === 'query' && <QueryView />}
 *     </RecceLayout>
 *   );
 * }
 * ```
 *
 * @example With header actions
 * ```tsx
 * <RecceLayout
 *   title="Recce"
 *   headerActions={
 *     <>
 *       <IconButton onClick={handleSettings}>
 *         <SettingsIcon />
 *       </IconButton>
 *       <IconButton onClick={handleHelp}>
 *         <HelpIcon />
 *       </IconButton>
 *     </>
 *   }
 *   navItems={navItems}
 *   activeNavId={activeNav}
 *   onNavClick={setActiveNav}
 * >
 *   {content}
 * </RecceLayout>
 * ```
 */
function RecceLayoutComponent({
  navItems,
  activeNavId,
  onNavClick,
  children,
  headerContent,
  footerContent,
  title = "Recce",
  logo,
  headerActions,
  sidebarWidth = 240,
  showHeader = true,
  showSidebar = true,
  sidebarCollapsed = false,
  collapsedSidebarWidth = 64,
  onSidebarToggle,
  className,
}: RecceLayoutProps) {
  const effectiveSidebarWidth = sidebarCollapsed
    ? collapsedSidebarWidth
    : sidebarWidth;

  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      {showHeader && (
        <AppBar
          position="fixed"
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            bgcolor: "background.paper",
            color: "text.primary",
            borderBottom: 1,
            borderColor: "divider",
            boxShadow: "none",
          }}
        >
          <Toolbar>
            {logo}
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ flexGrow: 0, mr: 2 }}
            >
              {title}
            </Typography>

            {/* Custom header content */}
            {headerContent && (
              <Box sx={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
                {headerContent}
              </Box>
            )}

            {!headerContent && <Box sx={{ flexGrow: 1 }} />}

            {/* Header actions */}
            {headerActions}
          </Toolbar>
        </AppBar>
      )}

      <Box sx={{ display: "flex", flex: 1, pt: showHeader ? "64px" : 0 }}>
        {/* Sidebar */}
        {showSidebar && (
          <Drawer
            variant="permanent"
            sx={{
              width: effectiveSidebarWidth,
              flexShrink: 0,
              "& .MuiDrawer-paper": {
                width: effectiveSidebarWidth,
                boxSizing: "border-box",
                top: showHeader ? "64px" : 0,
                height: showHeader ? "calc(100% - 64px)" : "100%",
                borderRight: 1,
                borderColor: "divider",
                transition: (theme) =>
                  theme.transitions.create("width", {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.enteringScreen,
                  }),
                overflowX: "hidden",
              },
            }}
          >
            <List>
              {navItems.map((item) => (
                <ListItemButton
                  key={item.id}
                  selected={activeNavId === item.id}
                  disabled={item.disabled}
                  onClick={() => onNavClick?.(item.id)}
                  sx={{
                    minHeight: 48,
                    justifyContent: sidebarCollapsed ? "center" : "initial",
                    px: 2.5,
                  }}
                >
                  {item.icon && (
                    <ListItemIcon
                      sx={{
                        minWidth: 0,
                        mr: sidebarCollapsed ? 0 : 3,
                        justifyContent: "center",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                  )}
                  {!sidebarCollapsed && (
                    <ListItemText
                      primary={item.label}
                      sx={{
                        opacity: sidebarCollapsed ? 0 : 1,
                      }}
                    />
                  )}
                  {!sidebarCollapsed && item.badge !== undefined && (
                    <Typography
                      variant="caption"
                      sx={{
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        px: 1,
                        py: 0.25,
                        borderRadius: 1,
                        fontSize: "0.7rem",
                      }}
                    >
                      {item.badge}
                    </Typography>
                  )}
                </ListItemButton>
              ))}
            </List>

            {/* Footer content in sidebar */}
            {footerContent && !sidebarCollapsed && (
              <Box
                sx={{ mt: "auto", p: 2, borderTop: 1, borderColor: "divider" }}
              >
                {footerContent}
              </Box>
            )}
          </Drawer>
        )}

        {/* Main content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            overflow: "auto",
            bgcolor: "background.default",
            width: showSidebar
              ? `calc(100% - ${effectiveSidebarWidth}px)`
              : "100%",
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Memoized RecceLayout component for performance optimization.
 */
export const RecceLayout = memo(RecceLayoutComponent);
RecceLayout.displayName = "RecceLayout";
