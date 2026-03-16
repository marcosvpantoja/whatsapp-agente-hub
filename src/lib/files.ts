import type { AttachmentUploadPayload } from "@/lib/api";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Nao foi possivel ler o anexo."));
        return;
      }

      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Nao foi possivel ler o anexo."));
    reader.readAsDataURL(file);
  });
}

export async function filesToAttachmentPayload(files: FileList | File[]) {
  const list = Array.from(files);

  return Promise.all<AttachmentUploadPayload>(
    list.map(async (file) => ({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      contentBase64: await fileToBase64(file),
    })),
  );
}
