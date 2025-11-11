// SERVER FODA [√TD]
const PORT = process.env.PORT || 3000;
const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) =>
  import('node-fetch').then(({default: fetch}) => fetch(...args));

const server = http.createServer();
const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
  console.log("Rodando na porta", PORT);
});

let users = new Map();

setInterval(() => {
  for (const [sock] of users) {
    if (sock.readyState === 1) {
      sock.ping(); 
    }
  }
}, 1000)

function broadcast(data, except = null) {
    const msg = JSON.stringify(data);
    for (const [sock] of users) {
        if (sock !== except && sock.readyState === 1) {
            sock.send(msg);
        }
    }
}

function enviarLista() {
    broadcast({
        tipo: "online",
        usuarios: [...users.values()]
    });
}

wss.on("connection", ws => {

    ws.on("message", async raw => {
        let data;
        try { data = JSON.parse(raw); } catch { return; }

        if (data.tipo === "login") {
            users.set(ws, data.nome);
            enviarLista();
            return;
        }

        if (!users.has(ws)) {
            ws.send(JSON.stringify({
                tipo: "msg",
                nome: "Sistema",
                texto: "Envia seu nome antes, animal."
            }));
            return;
        }

        if (data.tipo === "kill") {
            console.log("Servidor desligando a pedido do usuário:", data.nome);
            broadcast({ tipo: "msg",
                nome: "Sistema",
                texto: `⚠ ${data.nome} desligou o servidor`
            })
            setTimeout(() => {
                wss.close();
                process.exit();
            }, 200);
            return;
        }

        if (data.tipo === "msg") {
            broadcast({
                tipo: "msg",
                nome: users.get(ws),
                texto: data.texto
            }, ws);
            return;
        }

        if (data.tipo === "pv") {
            const alvo = data.para;
            for (const [sock, nome] of users) {
                if (nome === alvo) {
                    sock.send(JSON.stringify({
                        tipo: "pv",
                        de: users.get(ws),
                        texto: data.texto
                    }));
                }
            }
            return;
        }
        
        if (data.tipo === "ia") {
          async function chamarIA(prompt) {
          let api = await fetch(`https://shizuku-apis.shop/api/ias/gpt?texto=${prompt}&apitoken=Loon-dev`)
          let resultado = await api.json()
          let resposta = await resultado.resultado.data.resposta
          return resposta
          }
          let IA = await chamarIA(data.texto)
          broadcast({
            tipo: "ia",
            nome: "Sistema",
            texto: IA
          })
          return
        }
    });

    ws.on("close", () => {
        users.delete(ws);
        enviarLista();
    });
});
