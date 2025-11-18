import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DRIVE_FOLDER_ID = "1CW4zimagBD1syVRfbhSuH1NC5drzVZPt";
const DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE_FOLDER_ID}?usp=drive_link`;
const DRIVE_EMBED_URL = `https://drive.google.com/embeddedfolderview?id=${DRIVE_FOLDER_ID}#grid`;

export default function DriveCreatives() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Criativos Drive</h1>
          <p className="mt-1 text-muted-foreground">Acesso rápido aos vídeos no Google Drive.</p>
        </div>
        <Button asChild>
          <a href={DRIVE_FOLDER_URL} target="_blank" rel="noreferrer">Abrir no Drive</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pasta do Drive</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <iframe
              src={DRIVE_EMBED_URL}
              className="w-full h-[640px]"
              allow="fullscreen"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

