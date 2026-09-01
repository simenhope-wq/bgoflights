import { useState } from "react";
import { Check, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyBlocks, type CopyBlock } from "@/lib/flights";
import { toast } from "sonner";

interface CopyButtonProps {
  /** Getter for the blocks to place on the clipboard. */
  getBlocks: () => CopyBlock[];
  label: string;
  className?: string;
}

/** Copies as a table — ready to paste straight into PowerPoint. */
export function CopyButton({ getBlocks, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyBlocks(getBlocks());
    if (!ok) {
      toast.error("Fikk ikke tilgang til utklippstavlen");
      return;
    }
    setCopied(true);
    toast.success("Kopiert som ren tekst");
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCopy}
      title={label}
      className={cn(
        "h-7 shrink-0 gap-1 whitespace-nowrap rounded-[2px] border-board/35 bg-transparent px-1.5 font-signage text-[8px] font-medium uppercase tracking-[0.08em] text-board/75 transition-colors hover:border-board hover:bg-board hover:text-flap-ink sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-[10px] sm:tracking-[0.18em]",
        className
      )}
    >
      {copied ? (
        <Check className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
      ) : (
        <Clipboard className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
      )}
      <span>{copied ? "Kopiert" : label}</span>
    </Button>
  );
}
