export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (!text) {
    return false;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error("navigator.clipboard.writeText failed", error);
    }
  }

  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  const selection = document.getSelection();
  const selectedRange =
    selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  textarea.select();

  let successful = false;
  try {
    successful = document.execCommand("copy");
  } catch (error) {
    console.error("document.execCommand copy failed", error);
  } finally {
    document.body.removeChild(textarea);
    if (selectedRange && selection) {
      selection.removeAllRanges();
      selection.addRange(selectedRange);
    }
  }

  return successful;
};

export default copyToClipboard;
