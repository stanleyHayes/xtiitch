import { useEffect, useRef, useState } from "react";

export type FilePreview = { file: File; url: string };

// useFilePreviews keeps one object URL per selected file, alive exactly as long
// as that file is selected.
//
// Rebuilding the whole list on every change would be simpler and wrong: the URL
// is what an <img> is currently displaying, so revoking and re-creating it makes
// every thumbnail flicker whenever any one photo is added or removed. Instead
// each file keeps the URL it was given, new files get one, and removed files
// have theirs revoked — which also stops a long editing session leaking a
// decoded copy of every photo the owner ever picked.
export function useFilePreviews(files: readonly File[]): FilePreview[] {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  // The live map, so cleanup on unmount can revoke whatever is outstanding
  // without depending on the previews state that triggered it.
  const urls = useRef(new Map<File, string>());

  useEffect(() => {
    const next = new Map<File, string>();
    for (const file of files) {
      next.set(file, urls.current.get(file) ?? URL.createObjectURL(file));
    }
    for (const [file, url] of urls.current) {
      if (!next.has(file)) {
        URL.revokeObjectURL(url);
      }
    }
    urls.current = next;
    setPreviews(files.map((file) => ({ file, url: next.get(file) as string })));
  }, [files]);

  useEffect(
    () => () => {
      for (const url of urls.current.values()) {
        URL.revokeObjectURL(url);
      }
      urls.current = new Map();
    },
    [],
  );

  return previews;
}
