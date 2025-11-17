import {
  Avatar,
  Box,
  Icon,
  Menu,
  Portal,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";
import { FaCloud, FaUser } from "react-icons/fa";
import { RECCE_SUPPORT_CALENDAR_URL } from "@/constants/urls";
import { cacheKeys } from "@/lib/api/cacheKeys";
import { fetchGitHubAvatar, fetchUser } from "@/lib/api/user";

export default function AvatarDropdown() {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: cacheKeys.user(),
    queryFn: fetchUser,
    retry: false,
  });

  const { data: avatarUrl } = useQuery({
    queryKey: ["github-avatar", user?.id],
    queryFn: () => (user ? fetchGitHubAvatar(user.id) : Promise.resolve(null)),
    enabled: !!user?.id && user.login_type === "github",
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const ref = useRef<HTMLDivElement | null>(null);
  const getAnchorRect = () => ref.current?.getBoundingClientRect() ?? null;
  const showUserInfo = !isLoading && !error && user;

  return (
    <Menu.Root positioning={{ getAnchorRect }}>
      <Menu.Trigger asChild>
        {isLoading ? (
          <Box
            width="32px"
            height="32px"
            borderRadius="full"
            bg="white"
            color="brand.500"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
          >
            <Spinner size="sm" />
          </Box>
        ) : (
          <Avatar.Root
            outlineStyle="solid"
            outlineWidth="1px"
            outlineColor="white"
            ref={ref}
            size="xs"
            cursor="pointer"
          >
            <Avatar.Fallback name={user?.login ?? "U"} />
            {avatarUrl && <Avatar.Image src={avatarUrl} />}
          </Avatar.Root>
        )}
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content
            bg="white"
            borderColor="gray.200"
            boxShadow="lg"
            minW="180px"
          >
            <Box px={3} py={2}>
              {isLoading && (
                <Box display="flex" alignItems="center" gap={2}>
                  <Text fontSize="sm" color="gray.800">
                    Loading...
                  </Text>
                  <Spinner size="sm" />
                </Box>
              )}
              {error && (
                <Text fontSize="xs" color="red.500">
                  Failed to load user information
                </Text>
              )}
              {showUserInfo && (
                <>
                  <Text fontWeight="semibold" fontSize="sm" color="gray.800">
                    {user.login}
                  </Text>
                  {user.email && (
                    <Text fontSize="xs" color="gray.400">
                      {user.email}
                    </Text>
                  )}
                </>
              )}
            </Box>
            <Menu.Separator />
            <Menu.Item
              value="recce cloud"
              onClick={() =>
                window.open("https://cloud.datarecce.io/", "_blank")
              }
            >
              <Icon as={FaCloud} mr={2} />
              Recce Cloud
            </Menu.Item>
            <Menu.Item
              value="get live support"
              onClick={() => window.open(RECCE_SUPPORT_CALENDAR_URL, "_blank")}
            >
              <Icon as={FaUser} mr={2} />
              Get live support
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
}
