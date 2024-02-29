import Uppy, { UploadResult, UppyFile } from "@uppy/core";
import { Dashboard } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import { useEffect } from "react";
import XHRUpload from "@uppy/xhr-upload";
import { PUBLIC_API_URL } from "@/lib/const";
import { useQueryClient } from "@tanstack/react-query";
import { cacheKeys } from "@/lib/api/cacheKeys";

export default function CheckListUploadDashboard() {
  const queryClient = useQueryClient();
  const upload_endpoint = `${PUBLIC_API_URL}/api/checks/load`;

  const uppy = new Uppy({
    restrictions: {
      maxNumberOfFiles: 1,
      allowedFileTypes: [".json"],
    },
  }).use(XHRUpload, {
    endpoint: upload_endpoint,
    method: "POST",
  });

  useEffect(() => {
    function completedFn(result: UploadResult) {
      queryClient.invalidateQueries({ queryKey: cacheKeys.checks() });
    }
    function uploadErrorFn() {
      console.error("upload error");
    }

    uppy.on("complete", completedFn);
    uppy.on("upload-error", uploadErrorFn);
    return () => {
      uppy.off("complete", completedFn);
      uppy.off("upload-error", uploadErrorFn);
    };
  }, [uppy]);

  return <Dashboard uppy={uppy} height="24vh" width="100%" />;
}
