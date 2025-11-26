import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { ArrowLeft, FileText, FolderOpen, Settings, Sparkles } from "lucide-react";

const fonts = [
  { name: "Inter", family: "Inter, system-ui, sans-serif", description: "Clean & professional — your current font" },
  { name: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', system-ui, sans-serif", description: "Softer & warmer — my recommendation" },
  { name: "DM Sans", family: "'DM Sans', system-ui, sans-serif", description: "Geometric & distinctive" },
  { name: "Outfit", family: "Outfit, system-ui, sans-serif", description: "Rounded & approachable" },
];

function FontSample({ font }: { font: typeof fonts[0] }) {
  return (
    <Card className="overflow-visible">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle style={{ fontFamily: font.family }} className="text-xl">
            {font.name}
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {font.description}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4" style={{ fontFamily: font.family }}>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Template Builder Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage your document templates with ease. Organize sections, 
            add content blocks, and generate professional documents in minutes.
          </p>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" data-testid={`button-primary-${font.name}`}>
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Document
          </Button>
          <Button size="sm" variant="outline" data-testid={`button-outline-${font.name}`}>
            <FolderOpen className="w-4 h-4 mr-2" />
            Load Template
          </Button>
          <Button size="sm" variant="ghost" data-testid={`button-ghost-${font.name}`}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Badge>Documentation</Badge>
          <Badge variant="secondary">Templates</Badge>
          <Badge variant="outline">Draft</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>Project Proposal</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span>Client Contract</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground font-mono">
          Template tag: {"<<section_name>>"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function FontPreview() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Font Comparison</h1>
            <p className="text-muted-foreground">Pick the one that feels right for the app</p>
          </div>
        </div>

        <div className="grid gap-6">
          {fonts.map((font) => (
            <FontSample key={font.name} font={font} />
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Let me know which one you prefer and I'll apply it to the app!
        </p>
      </div>
    </div>
  );
}
