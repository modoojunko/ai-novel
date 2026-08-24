import { useCallback, useRef, useState } from "react";
import ImportUploadZone from "./ImportUploadZone";
import ImportPreviewTree from "./ImportPreviewTree";
import Modal from "@/components/design/Modal";
import { importParse, importPersist, type ImportPreviewData, type VolumeImportData } from "@/lib/api";
import { toast } from "@/lib/toast";

interface ImportNovelModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (novelId: string) => void;
}

type ImportStep = "upload" | "preview";

/** 导入弹窗：上传 → 解析预览（可编辑卷/章）→ 确认入库 → 跳转新书。 */
export default function ImportNovelModal({
  open,
  onClose,
  onImported,
}: ImportNovelModalProps) {
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewData | null>(null);
  const [volumes, setVolumes] = useState<VolumeImportData[]>([]);
  const originalVolumesRef = useRef<VolumeImportData[]>([]);

  const reset = useCallback(() => {
    setStep("upload");
    setParsing(false);
    setSaving(false);
    setPreview(null);
    setVolumes([]);
    originalVolumesRef.current = [];
  }, []);

  const handleClose = useCallback(() => {
    if (parsing || saving) return;
    reset();
    onClose();
  }, [parsing, saving, reset, onClose]);

  const handleFileSelected = useCallback(
    async (file: File) => {
      setParsing(true);
      try {
        const data = await importParse(file);
        setPreview(data);
        setVolumes(data.volumes);
        originalVolumesRef.current = data.volumes;
        setStep("preview");
        if (data.warnings && data.warnings.length > 0) {
          toast.info(`${data.warnings.length} 处解析提示，可在预览中检查`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "解析失败，请检查文件格式");
      } finally {
        setParsing(false);
      }
    },
    [],
  );

  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setSaving(true);
    try {
      const name = preview.title?.trim() || "导入的小说";
      const result = await importPersist({ name, volumes });
      toast.success(`《${result.name}》已导入`);
      reset();
      onImported(result.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "入库失败");
    } finally {
      setSaving(false);
    }
  }, [preview, volumes, reset, onImported]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      locked={parsing || saving}
      title="导入小说"
      width={560}
    >
      {step === "upload" ? (
        <ImportUploadZone onFileSelected={handleFileSelected} onCancel={handleClose} />
      ) : (
        <ImportPreviewTree
          title={preview?.title}
          volumes={volumes}
          onVolumesChange={setVolumes}
          onConfirm={() => void handleConfirm()}
          onBack={() => setStep("upload")}
          onReset={() => setVolumes(originalVolumesRef.current)}
          loading={saving}
        />
      )}
    </Modal>
  );
}
