# Decky

Sticky Notes sempre visíveis no ecrã. Serve para deixar
"é isto que tens a fazer" à vista, sem abrir uma app de notas pesada.

Stack: Electron + `electron-store`, renderer em HTML/CSS/JS simples e rápido.

## Estado

Versão `0.3.0`.
- **Arranque Inteligente e Leve**: abre apenas 1 nota (a mais recente). As restantes notas anteriores estão guardadas e acessíveis a qualquer momento através do Menu Hambúrguer (☰).
- **Paleta de Cores**: 6 cores personalizadas por nota (Amarelo, Verde, Azul, Pêssego, Roxo e Dark Mode).
- **Atalhos de Teclado**: máxima produtividade sem tirar as mãos do teclado.
- **Proteção de Dados**: confirmação rápida antes de apagar notas na gaveta.
- **Performance**: baixo consumo de RAM e IPC otimizado.

## Requisitos e instalação

- Ubuntu (GNOME) com sessão X11 ou XWayland.
- Node.js (versão recente) e npm.

```bash
npm install
npm run start
```

## Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `Ctrl + N` | Criar nova nota instantaneamente |
| `Ctrl + H` ou `Ctrl + M` | Abrir / fechar menu de Notas Anteriores |
| `Escape` | Fechar menu ou paleta de cores e voltar a escrever |
| `Ctrl + W` | Fechar nota (guardando no histórico de notas anteriores) |
| `Ctrl + P` | Alternar Always-on-top (fixar no topo de todas as janelas e em todos os ambientes virtuais) |

## Utilização

- **Cabeçalho da Nota**:
  - **☰ (Menu Hambúrguer - `Ctrl+H`)**: abre a gaveta com as notas anteriores, pesquisa em tempo real, botão de criar nova nota e botão de sair da aplicação.
  - **+ (Nova Nota - `Ctrl+N`)**: cria imediatamente uma nova nota adesiva no ecrã.
  - **🎨 (Paleta de Cores)**: seleciona a cor da nota (amarelo, verde pastel, azul céu, pêssego, roxo suave ou modo escuro).
  - **Barra Central**: arrasta a nota pelo ecrã.
  - **📌 (Always on Top - `Ctrl+P`)**: fixa a nota no topo de todas as janelas e em todos os ambientes de trabalho (workspaces virtuais com `Ctrl+Alt+Setas`).
  - **× (Fechar Nota - `Ctrl+W`)**: fecha a janela da nota guardando o conteúdo no histórico. Se fechar a última nota aberta, o processo da aplicação termina automaticamente.
- **Gaveta de Notas Anteriores**:
  - Lista com scroll de todas as notas guardadas com indicação de data/hora e badges (`Esta nota` / `Aberta`).
  - Clicar numa nota reabre-a ou foca a sua janela.
  - Ícone de lixeira (**🗑**) com confirmação inline ("Sim / Não") para apagar definitivamente a nota do disco.
  - Botão **Sair do Decky** para encerrar todas as notas e terminar o processo.
- **Tray**: opções rápidas no painel do sistema (*Nova nota*, *Mostrar todas as notas*, *Esconder todas*, *Sair*).

## Dados

As notas ficam num ficheiro JSON gerido pelo `electron-store` em `~/.config/decky/notes.json`.

Formato de cada nota:

```json
{
  "id": "note_<timestamp>_<aleatório>",
  "content": "",
  "x": 60, "y": 60, "width": 280, "height": 240,
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
├── main/       processo principal: janelas, tray, store, IPC, single instance, startup
│   └── assets/icon.png
├── preload/    API exposta ao renderer via contextBridge
└── renderer/   UI da nota, temas de cores e gaveta de histórico (HTML/CSS/JS)
```

| Canal IPC | Direcção | Função |
|---|---|---|
| `notes:get-all` | renderer → main | devolve todas as notas guardadas com estado de abertura |
| `notes:create` | renderer → main | cria e abre uma nova nota |
| `notes:open` | renderer → main | abre ou foca uma nota existente pelo ID |
| `notes:close-window` | renderer → main | fecha a janela da nota, guardando no histórico |
| `notes:delete` | renderer → main | fecha a janela e remove a nota permanentemente do store |
| `notes:update-content` | renderer → main | atualiza o conteúdo da nota |
| `notes:set-color` | renderer → main | define e persiste a cor da nota |
| `notes:toggle-always-on-top` | renderer → main | alterna "sempre por cima" e visibilidade em todos os workspaces |
| `app:quit` | renderer → main | encerra o Electron e liberta o terminal |
| `note:init` | main → renderer | envia os dados da nota ao abrir |
| `note:bounds` | main → renderer | envia a posição/tamanho guardados |
| `notes:updated` | main → renderer | notifica alterações na lista de notas para atualizar a UI |
