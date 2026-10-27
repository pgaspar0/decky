# Decky

Sticky Notes sempre visíveis no ecrã. Serve para deixar
"é isto que tens a fazer" à vista, sem abrir uma app de notas.

Stack: Electron + `electron-store`, renderer em HTML/CSS/JS simples.

## Estado

Versão `0.2.0`. Suporte a instância única, persistência em todos os ambientes de trabalho (workspaces), menu hambúrguer com histórico de notas e encerramento limpo do processo.

## Requisitos e instalação

- Ubuntu (GNOME) com sessão X11 ou XWayland.
- Node.js (versão recente) e npm.

```bash
npm install
npm run start
```

## Utilização

- **Cabeçalho da Nota**:
  - **☰ (Menu Hambúrguer)**: abre a gaveta com as notas anteriores, pesquisa em tempo real, botão de criar nova nota e botão de sair da aplicação.
  - **+ (Nova Nota)**: cria imediatamente uma nova nota adesiva no ecrã.
  - **Barra Central**: arrasta a nota pelo ecrã.
  - **📌 (Always on Top)**: fixa a nota no topo de todas as janelas e em todos os ambientes de trabalho (workspaces virtuais com `Ctrl+Alt+Setas`).
  - **× (Fechar Nota)**: fecha a janela da nota guardando o conteúdo no histórico ("Notas Anteriores"). Se a nota estiver vazia, é descartada. Se fechar a última nota aberta, o processo da aplicação termina automaticamente.
- **Gaveta de Notas Anteriores**:
  - Lista com scroll de todas as notas guardadas, com indicação de data/hora e se a nota já está aberta no ecrã.
  - Clicar numa nota reabre-a ou foca a sua janela.
  - Ícone de lixeira (**🗑**) para apagar definitivamente a nota do disco.
  - Botão **Sair do Decky** para encerrar todas as notas e terminar o processo.
- **Tray**: opções rápidas no painel do sistema (*Nova nota*, *Mostrar todas*, *Esconder todas*, *Sair*).

## Dados

As notas ficam num ficheiro JSON gerido pelo `electron-store`, normalmente em
`~/.config/decky/notes.json`.

Formato de cada nota:

```json
{
  "id": "note_<timestamp>_<aleatório>",
  "content": "",
  "x": 60, "y": 60, "width": 260, "height": 220,
  "color": "#ffe14d",
  "alwaysOnTop": true,
  "isOpen": true,
  "completed": false,
  "createdAt": 0,
  "updatedAt": 0
}
```

## Arquitectura

```
src/
├── main/       processo principal: janelas, tray, store, IPC, single instance
│   └── assets/icon.png
├── preload/    API exposta ao renderer via contextBridge
└── renderer/   UI da nota e gaveta de notas (HTML/CSS/JS)
```

| Canal IPC | Direcção | Função |
|---|---|---|
| `notes:get-all` | renderer → main | devolve todas as notas guardadas com estado de abertura |
| `notes:create` | renderer → main | cria e abre uma nova nota |
| `notes:open` | renderer → main | abre ou foca uma nota existente pelo ID |
| `notes:close-window` | renderer → main | fecha a janela da nota, guardando no histórico |
| `notes:delete` | renderer → main | fecha a janela e remove a nota permanentemente do store |
| `notes:update-content` | renderer → main | atualiza o conteúdo da nota |
| `notes:toggle-always-on-top` | renderer → main | alterna "sempre por cima" e visibilidade em todos os workspaces |
| `app:quit` | renderer → main | encerra o Electron e liberta o terminal |
| `note:init` | main → renderer | envia os dados da nota ao abrir |
| `note:bounds` | main → renderer | envia a posição/tamanho guardados |
| `notes:updated` | main → renderer | notifica alterações na lista de notas para atualizar a UI |
