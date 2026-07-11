import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import NotificationsRounded from "@mui/icons-material/NotificationsRounded";
import { tokens } from "../../theme";
import { NotificationSummary } from "./types";
import { usePagedItems } from "./hooks";
import { Panel } from "../../components/ui/Panel";
import { ToneChip } from "../../components/ui/ToneChip";
import { InlineEmptyState } from "../../components/ui/InlineEmptyState";
import { shortDateTime, messageKindLabel, notificationTone } from "./utils";
import { PaginationFooter } from "../../components/ui/PaginationFooter";

export function NotificationPanel({
  notifications,
}: {
  notifications: NotificationSummary[];
}) {
  const {
    page: notificationPage,
    pageCount: notificationPageCount,
    pagedItems: pagedNotifications,
    setPage: setNotificationPage,
  } = usePagedItems(notifications, 8, notifications.length);

  return (
    <Panel id="messages">
      <Box sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
            <Box sx={{ color: "primary.main" }}>
              <NotificationsRounded />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Message log</Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Outbound WhatsApp/SMS intents created by order events.
              </Typography>
            </Box>
          </Stack>
          <ToneChip
            label={`${notifications.length} total`}
            tone={tokens.burgundy}
          />
        </Stack>
      </Box>

      {notifications.length === 0 ? (
        <Box sx={{ px: 2.5, pb: 2.5 }}>
          <InlineEmptyState
            icon={<NotificationsRounded sx={{ fontSize: 38 }} />}
            title="No messages yet"
            helper="Order, booking, payment, and handover events will create entries in this outbox log."
          />
        </Box>
      ) : (
        <>
          {pagedNotifications.map((message) => (
            <Box
              key={message.message_id}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.4,
                borderTop: "1px solid",
                borderColor: "divider",
                display: "grid",
                gap: 1,
                gridTemplateColumns: { xs: "1fr", sm: "minmax(0, 1fr) auto" },
                alignItems: "center",
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900 }} noWrap>
                  {messageKindLabel(message.kind)}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
                >
                  {message.channel.toUpperCase()} to {message.recipient} ·{" "}
                  {shortDateTime(message.created_at)}
                </Typography>
              </Box>
              <ToneChip
                label={`${message.status} · ${message.attempts}`}
                tone={notificationTone(message.status)}
              />
            </Box>
          ))}
          <Box sx={{ px: { xs: 2, md: 2.5 }, pb: 1.5 }}>
            <PaginationFooter
              count={notificationPageCount}
              label="messages"
              page={notificationPage}
              total={notifications.length}
              onChange={setNotificationPage}
            />
          </Box>
        </>
      )}
    </Panel>
  );
}