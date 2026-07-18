import { useCallback, useEffect, useState, useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import {
  api,
  type Design,
  type PlaceOrderResult,
} from "../../../src/api";
import { CenterState } from "../../../src/ui";
import { fonts, spacing, type Palette } from "../../../src/theme";
import { useTheme } from "../../../src/theme-mode";
import DesignGallery from "./DesignGallery";
import DesignOrderConfirmation from "./DesignOrderConfirmation";
import DesignOrderForm from "./DesignOrderForm";

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; design: Design };

export default function DesignScreen() {
  const { palette } = useTheme();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ phase: "loading" });
  const [order, setOrder] = useState<PlaceOrderResult | null>(null);

  const load = useCallback(async () => {
    if (!handle) return;
    setState({ phase: "loading" });
    const result = await api.design(handle);
    if (result.ok) {
      setState({ phase: "ready", design: result.data });
    } else {
      setState({
        phase: "error",
        message:
          result.status === 404
            ? "This piece is no longer available."
            : "Couldn't load this piece. Please retry.",
      });
    }
  }, [handle]);

  useEffect(() => {
    load();
  }, [load]);

  if (state.phase === "loading") return <CenterState loading />;
  if (state.phase === "error")
    return (
      <CenterState title="Unavailable" hint={state.message} onRetry={load} />
    );

  const { design } = state;
  const store = design.store;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: design.title }} />

      <DesignGallery design={design} />

      <Text style={styles.title}>{design.title}</Text>
      {store ? (
        <Pressable onPress={() => router.push(`/store/${store.handle}`)}>
          <Text style={styles.storeLink}>{store.name} ›</Text>
        </Pressable>
      ) : null}
      {design.description ? (
        <Text style={styles.description}>{design.description}</Text>
      ) : null}

      {order ? (
        <DesignOrderConfirmation
          order={order}
          onTrack={() => router.push(`/track/${order.order_id}`)}
        />
      ) : store ? (
        <DesignOrderForm design={design} store={store} onOrdered={setOrder} />
      ) : null}
    </ScrollView>
  );
}

const makeStyles = (palette: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.cream },
    content: { padding: spacing(3), paddingBottom: spacing(6) },
    title: {
      fontFamily: fonts.display,
      fontSize: 28,
      color: palette.ink,
      fontWeight: "700",
      marginTop: spacing(2),
    },
    storeLink: {
      fontFamily: fonts.body,
      fontSize: 14,
      fontWeight: "700",
      color: palette.burgundy,
      marginTop: spacing(0.5),
    },
    description: {
      fontFamily: fonts.body,
      fontSize: 15,
      color: palette.ink,
      lineHeight: 23,
      marginTop: spacing(1.5),
    },
  });
