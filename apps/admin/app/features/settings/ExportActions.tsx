import { Form } from "react-router";
import Button from "@mui/material/Button";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import FileDownloadRounded from "@mui/icons-material/FileDownloadRounded";
import { Section } from "../shared/types";

export function ExportActions({
  datasetId,
  source,
  sourceLabel,
  onSelect,
}: {
  datasetId: string;
  source: Section;
  sourceLabel: string;
  onSelect: (section: Section) => void;
}) {
  return (
    <>
      <Form method="post" reloadDocument>
        <input
          type="hidden"
          name="intent"
          value="admin-export:download"
        />
        <input type="hidden" name="dataset" value={datasetId} />
        <Button
          type="submit"
          variant="contained"
          startIcon={<FileDownloadRounded />}
        >
          Download CSV
        </Button>
      </Form>
      <Button
        variant="outlined"
        endIcon={<ArrowForwardRounded />}
        onClick={() => onSelect(source)}
      >
        {sourceLabel}
      </Button>
    </>
  );
}
