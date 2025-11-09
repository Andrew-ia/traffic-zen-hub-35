# Importar tarefas para o ClickUp

Este utilitário cria tarefas em uma lista do ClickUp a partir de um arquivo **CSV** ou **JSON**.

## Pré-requisitos
- Defina `CLICKUP_TOKEN` (token da sua conta ClickUp) no ambiente.
- Tenha o ID da lista ou informe o nome da lista e o ID do Space.

## Formatos suportados

### CSV
Header recomendado:
```
name,description,status,due_date,start_date,tags,parent
```
- `due_date` e `start_date`: `YYYY-MM-DD` (opcionalmente com hora) ou timestamp em milissegundos.
- `tags`: separadas por vírgula.
- `parent`: opcional. Nome da tarefa pai na mesma lista. Se existir (ou for criada no mesmo import), a tarefa é criada como subtarefa. Se a tarefa já existir, o script atualiza o `parent` (reparent) em vez de duplicar.

Exemplo: `scripts/clickup/tasks-sample.csv`.

### JSON
Array de objetos com os mesmos campos do CSV:
```json
[
  {
    "name": "🟣 Ideia • Blog Post SEO",
    "description": "Levantar tópicos e referências",
    "status": "IDEIA",
    "due_date": "2025-11-12",
    "start_date": "2025-11-10",
    "tags": ["content", "seo"]
  }
]
```

## Uso

Com **ID da lista**:
```bash
CLICKUP_TOKEN=pk_xxx \
node scripts/clickup/import-tasks.cjs \
  --file scripts/clickup/tasks-sample.csv \
  --list-id 901322143696
```

Com **nome da lista** e **ID do Space**:
```bash
CLICKUP_TOKEN=pk_xxx \
node scripts/clickup/import-tasks.cjs \
  --file tasks.json \
  --list-name "Content Calendar" \
  --space-id 901311689002
```

## Dicas
- O script normaliza acentos e maiúsculas/minúsculas nos `status`. Se o status informado não existir na lista, a tarefa é criada com o status padrão e um aviso é impresso.
- Se não quiser definir status, omita a coluna/campo `status`.
- Datas que não forem reconhecidas serão ignoradas (a tarefa é criada sem data).
- Tags são opcionais.

### Duplicados e hierarquia
- O script evita duplicar tarefas: se encontrar uma tarefa existente com o mesmo `name`, imprime `⏭️ Já existe` e não cria novamente.
- Se você informar `parent` para uma tarefa já existente, o script tenta reparentear (transformar em subtarefa) automaticamente.

## Validação
Após executar, o script imprimirá os links das tarefas criadas. Você também pode checar diretamente na UI do ClickUp.
