import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Folder } from "lucide-react";

interface DriveFolder {
  id: string;
  name: string;
  description: string;
  url: string;
}

const DRIVE_FOLDERS: DriveFolder[] = [
  {
    id: "1CW4zimagBD1syVRfbhSuH1NC5drzVZPt",
    name: "Drive Principal",
    description: "Pasta principal de criativos e materiais",
    url: "https://drive.google.com/drive/folders/1CW4zimagBD1syVRfbhSuH1NC5drzVZPt"
  },
  {
    id: "14xINdKQ6xeRZsmbmMcjIaYLzQnhiP9aR",
    name: "Drive Vermezzo",
    description: "Pasta de criativos Vermezzo",
    url: "https://drive.google.com/drive/folders/14xINdKQ6xeRZsmbmMcjIaYLzQnhiP9aR?usp=drive_link"
  }
];

export default function DriveCreatives() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Criativos Drive</h1>
          <p className="mt-1 text-muted-foreground">
            Acesso rápido aos vídeos e materiais no Google Drive.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {DRIVE_FOLDERS.map((folder) => (
          <Card key={folder.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Folder className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">{folder.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {folder.description}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <a 
                  href={folder.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  Abrir no Google Drive
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">💡 Dica</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Clique nos botões acima para abrir as pastas diretamente no Google Drive.
            Certifique-se de estar logado com a conta correta para ter acesso aos materiais.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

