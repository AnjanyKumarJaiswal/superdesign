import { useState } from "react";
import { Figma } from "lucide-react";

const FileIdInput = ({ onSubmit }) => {
  const [fileId, setFileId] = useState(() => localStorage.getItem("figma_file_id") || "");

  const handleSubmit = () => {
    if (!fileId.trim()) return;

    localStorage.setItem("figma_file_id", fileId.trim());

    if (onSubmit) {
      onSubmit(fileId.trim());
    }
  };

  const handleChange = (e) => {
    let value = e.target.value.trim();
    console.log('Original input:', value);

    try {
      if (value.includes('figma.com/file/')) {
        const urlParts = value.split('figma.com/file/');
        if (urlParts.length > 1) {
          const fileIdPart = urlParts[1].split('/')[0].split('?')[0];
          console.log('Extracted file ID from URL:', fileIdPart);
          value = fileIdPart;
        }
      }
      else if (value.includes('figma.com/proto/')) {
        const urlParts = value.split('figma.com/proto/');
        if (urlParts.length > 1) {
          const fileIdPart = urlParts[1].split('/')[0].split('?')[0];
          console.log('Extracted file ID from prototype URL:', fileIdPart);
          value = fileIdPart;
        }
      }
      else if (value.includes('embed.figma.com')) {
        const match = value.match(/file\/([a-zA-Z0-9]+)/);
        if (match && match[1]) {
          console.log('Extracted file ID from embed URL:', match[1]);
          value = match[1];
        }
      }
    } catch (error) {
      console.error("Error parsing Figma URL:", error);
    }

    console.log('Final file ID:', value);
    setFileId(value);
  };

  return (
    <div className="p-4 border border-white/10 rounded-xl bg-white/5 mb-4">
      <div className="mb-2 flex items-center gap-2">
        <Figma className="w-4 h-4 text-purple-400" />
        <label className="text-sm font-medium text-white">Figma File ID</label>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={fileId}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSubmit();
            }
          }}
          placeholder="paste-your-figma-file-id-here or full URL"
          className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-400/60"
        />
        <button
          onClick={handleSubmit}
          disabled={!fileId.trim()}
          className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-white/5 disabled:cursor-not-allowed border border-purple-400/40 rounded-lg text-white text-sm font-medium transition-all"
        >
          {fileId ? "Save" : "Set ID"}
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Find this in your Figma file URL: figma.com/file/
        <span className="text-purple-400">FILE_ID</span>/...
      </p>
    </div>
  );
};

export default FileIdInput;