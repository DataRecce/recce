import "react-data-grid/lib/styles.css";
import DataGrid , { DataGridProps } from "react-data-grid";
import { useCopyToClipboardButton } from "@/lib/hooks/ScreenShot";

interface ScreenshotDataGridProps extends DataGridProps<any> {
  enableScreenshot?: boolean;
}

export function ScreenshotDataGrid({
  enableScreenshot=true,
  ...props
}: ScreenshotDataGridProps) {
  const { ref, CopyToClipboardButton } = useCopyToClipboardButton();
  return (<>
    <DataGrid
      ref={ref}
      {...props}/>
    {enableScreenshot && <CopyToClipboardButton imageType="png" />}
  </>);
}
