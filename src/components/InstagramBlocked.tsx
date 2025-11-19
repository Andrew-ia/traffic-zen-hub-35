import { Card, CardContent } from "@/components/ui/card";
import { Shield, AlertTriangle } from "lucide-react";

export default function InstagramBlocked() {
  return (
    <div className="p-6">
      <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Shield className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-red-800 mb-4">
              Funcionalidade Instagram Bloqueada
            </h2>
            <div className="max-w-md mx-auto space-y-3">
              <div className="flex items-start gap-3 text-left">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-red-700 text-sm">
                  <strong>Sistema de Proteção Ativado:</strong> O acesso à funcionalidade 
                  Instagram foi permanentemente bloqueado devido a problemas críticos de 
                  compatibilidade que causam travamento completo do sistema.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200">
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  <strong>Problema identificado:</strong> As tabelas do banco de dados 
                  relacionadas ao Instagram contêm estruturas ou dados que causam 
                  deadlocks/travamentos no MacBook.
                </p>
              </div>
              <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg border border-yellow-200">
                <p className="text-yellow-800 dark:text-yellow-300 text-xs">
                  Este bloqueio é uma medida de segurança para proteger a estabilidade 
                  do sistema. A funcionalidade não pode ser restaurada sem resolver 
                  os problemas estruturais no banco de dados.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}