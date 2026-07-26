import { useCallback, useEffect, useState } from "react";

export interface SelectionCapture {
  start: number;
  end: number;
  text: string;
  fullText: string;
}

export function captureSelection(
  textarea: HTMLTextAreaElement | null
): SelectionCapture | null {
  if (!textarea) return null;
  const { selectionStart, selectionEnd, value } = textarea;
  if (
    selectionStart === null ||
    selectionEnd === null ||
    selectionStart === selectionEnd
  ) {
    return null;
  }
  return {
    start: selectionStart,
    end: selectionEnd,
    text: value.slice(selectionStart, selectionEnd),
    fullText: value,
  };
}

export function useSelectionCapture(
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
) {
  const [hasSelection, setHasSelection] = useState(false);
  const [selectedText, setSelectedText] = useState("");

  const captureNow = useCallback(() => {
    const cap = captureSelection(textareaRef.current);
    setHasSelection(cap !== null);
    setSelectedText(cap?.text ?? "");
    return cap;
  }, [textareaRef]);

  useEffect(() => {
    const handleEvent = () => captureNow();
    document.addEventListener("mouseup", handleEvent);
    document.addEventListener("keyup", handleEvent);
    return () => {
      document.removeEventListener("mouseup", handleEvent);
      document.removeEventListener("keyup", handleEvent);
    };
  }, [captureNow]);

  const clearSelection = useCallback(() => {
    setHasSelection(false);
    setSelectedText("");
  }, []);

  return { hasSelection, selectedText, captureNow, clearSelection };
}
