import { useState } from "react";
import { Alert, Image, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pickAndUploadDesignImage } from "../../../../src/businessMedia";
import { useTheme } from "../../../../src/theme-mode";
import type { makeStyles } from "../../../business/design-editor.styles";

type Styles = ReturnType<typeof makeStyles>;

export function DesignMediaEditor({
  images,
  onChange,
  styles,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  styles: Styles;
}) {
  const { palette } = useTheme();
  const [uploading, setUploading] = useState(false);
  const add = async () => {
    setUploading(true);
    const result = await pickAndUploadDesignImage();
    setUploading(false);
    if (result.ok) onChange([...images, result.url]);
    else if (result.error !== "cancelled") {
      Alert.alert(
        result.error === "permission" ? "Photo access needed" : "Upload failed",
        result.error === "permission"
          ? "Allow photo access in device settings to add catalogue imagery."
          : "Check Cloudinary configuration and try again.",
      );
    }
  };
  return (
    <View style={styles.mediaGrid}>
      {images.map((image, index) => (
        <View key={`${image}-${index}`} style={styles.mediaTile}>
          <Image source={{ uri: image }} style={styles.mediaImage} />
          <Pressable
            accessibilityLabel={`Remove image ${index + 1}`}
            onPress={() => onChange(images.filter((_, item) => item !== index))}
            style={styles.mediaRemove}
          >
            <Ionicons name="close" size={16} color={palette.onAccent} />
          </Pressable>
        </View>
      ))}
      <Pressable
        disabled={uploading}
        onPress={() => void add()}
        style={styles.mediaAdd}
      >
        <Ionicons name="images-outline" size={24} color={palette.burgundy} />
        <Text style={styles.mediaAddText}>
          {uploading ? "Uploading…" : "Add photo"}
        </Text>
      </Pressable>
    </View>
  );
}
