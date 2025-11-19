import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram } from "lucide-react";

export default function Instagram() {
  console.log('Instagram page loading...');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Instagram className="w-8 h-8 text-purple-600" />
          Instagram Analytics
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Funcionando</div>
            <p className="text-xs text-muted-foreground">Página carregou com sucesso</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teste de Funcionalidade</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Esta é uma versão simplificada da página para identificar problemas.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Se você conseguir ver esta mensagem, o problema está no código complexo da página original.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}