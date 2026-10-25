# Decky

Sticky Notes sempre visíveis no ecrã. Serve para deixar
"é isto que tens a fazer" à vista, sem abrir uma app de notas.

Stack: Electron + `electron-store`, renderer em HTML/CSS/JS simples.

## Estado

Versão `0.1.0`, MVP em desenvolvimento.

## Requisitos e instalação

- Ubuntu (GNOME) com sessão X11 (não testado em Wayland).
- Node.js (versão recente) e npm.

```bash
npm install
npm run start
```

## Utilização

- **Tray**: *Nova nota*, *Mostrar todas*, *Esconder todas*, *Sair*. Clicar no
  ícone mostra as notas. Na primeira execução é criada uma nota automaticamente.
- **Nota**: arrasta pela barra superior, redimensiona pelas bordas, escreve
  directamente (guarda sozinho ~300 ms depois de parares).
- **📌** alterna "sempre por cima". **×** apaga a nota, sem confirmação e sem
  forma de a recuperar.

## Dados

As notas ficam num ficheiro JSON gerido pelo `electron-store`, normalmente em
`~/.config/decky/notes.json` (confirma com `ls ~/.config/decky`).

Formato de cada nota:

```json
{
  "id": "note_<timestamp>_<aleatório>",
  "content": "",
  "x": 60, "y": 60, "width": 260, "height": 220,
  "color": "#ffe14d",
  "alwaysOnTop": true,
  "completed": false,
  "createdAt": 0,
  "updatedAt": 0
}
```

## Arquitectura

```
src/
├── main/       processo principal: janelas, tray, store, IPC
│   └── assets/icon.png
├── preload/    API mínima exposta ao renderer (contextIsolation activo)
└── renderer/   UI de uma nota (HTML/CSS/JS)
```

O renderer corre isolado (`contextIsolation`, sem Node, `sandbox`) e só fala
com o main através de `window.notesAPI`.

| Canal IPC | Direcção | Função |
|---|---|---|
| `notes:update-content` | renderer → main | guarda o texto da nota |
| `notes:delete` | renderer → main | fecha a janela e apaga a nota do store |
| `notes:toggle-always-on-top` | renderer → main | alterna "sempre por cima" e guarda |
| `diagnostics:get` | renderer → main | devolve `XDG_SESSION_TYPE` (andaime do teste Wayland) |
| `note:init` | main → renderer | envia os dados da nota ao abrir |
| `note:bounds` | main → renderer | envia a posição/tamanho guardados |

## Scripts

| Script | O que faz |
|---|---|
| `npm run start` | arranque normal; é o único necessário |
| `npm run start:x11` | força a plataforma X11/XWayland (diagnóstico) |
| `npm run start:wayland` | força Wayland; falha numa sessão sem compositor Wayland |

## Limitações conhecidas

Não corrigidas; ordenadas por impacto provável.

1. **Sem instância única.** Correr a app duas vezes abre dois processos, dois
   ícones de tray e duas escritas no mesmo ficheiro. Falta
   `app.requestSingleInstanceLock()`. Importa antes de existir arranque
   automático.
2. **Erro possível após fechar uma nota.** Se a janela fechar menos de 400 ms
   depois de um `move`/`resize`, o temporizador de debounce chama `getBounds()`
   numa janela já destruída e lança um erro. Falta `clearTimeout` no evento
   `closed`.
3. **Últimos caracteres podem perder-se ao sair.** O texto é gravado 300 ms
   depois de escrever; sair pelo tray nesse intervalo perde o que foi escrito.
4. **Andaime do teste ainda na UI.** O rodapé da nota mostra `sessao:`/`pos:` e
   há o canal `diagnostics:get`. Ruído para quem usa a app.
5. **Campos sem uso.** `color` e `completed` são guardados, mas a UI ignora-os.
6. **Wayland nativo não validado.** Todos os testes foram em X11. Ver
   `docs/CONTEXTO.md`, secção 4.
7. **Sem arranque automático nem atalho global.**

## Próximos passos

1. Limpar o andaime do teste (rodapé, `diagnostics:get`, scripts `start:*`,
   comentários sobre Wayland em `src/main/index.js`).
2. Corrigir as limitações 1 a 3.
3. Implementar fluxo que está como promessa.
4. Só depois: cores, atalho global, arranque automático.
