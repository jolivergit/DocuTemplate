import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode;
  side: "left" | "right";
  defaultCollapsed?: boolean;
  collapsedTitle?: string;
  expandedClassName?: string;
}

export function CollapsiblePanel({
  title,
  children,
  side,
  defaultCollapsed = false,
  collapsedTitle,
  expandedClassName = "",
}: CollapsiblePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const panelId = title.toLowerCase().replace(/\s+/g, '-');
  const borderClass = side === "left" ? "border-r" : "border-l";

  if (isCollapsed) {
    return (
      <div 
        className={`w-10 flex-none ${borderClass} bg-card flex flex-col items-center py-4`}
        data-testid={`panel-${panelId}-collapsed`}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(false)}
          className="mb-3"
          data-testid={`button-expand-${panelId}`}
        >
          {side === "left" ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
        <span 
          className="text-xs font-medium text-muted-foreground"
          style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
          data-testid={`text-collapsed-title-${panelId}`}
        >
          {collapsedTitle || title}
        </span>
      </div>
    );
  }

  return (
    <div 
      className={`flex flex-col h-full overflow-hidden ${borderClass} ${expandedClassName}`}
      data-testid={`panel-${panelId}`}
    >
      <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(true)}
          data-testid={`button-collapse-${panelId}`}
        >
          {side === "left" ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
