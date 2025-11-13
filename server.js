// SERVER FODA [√TD]
const PORT = process.env.PORT || 3000;
const WebSocket = require("ws");
const http = require("http");
const fetch = (...args) =>
  import('node-fetch').then(({default: fetch}) => fetch(...args));

const server = http.createServer();
const wss = new WebSocket.Server({ server });
const mem = {}

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

function addMem(userId, role, content) {
  if (!mem[userId]) mem[userId] = []
  mem[userId].push({ role, content })
  if (mem[userId].length > 5) mem[userId].shift();
}

function addContext(userId, minMensagens = 3) {
  let historico = mem[userId] || [];
  if (historico.length <= minMensagens) {
    return historico.map(m => `${m.role === "user" ? "Usuário" : "Douglas"}: ${m.content}`).join("\n");
  }
  let antigas = historico.slice(0, historico.length - minMensagens);
  let recentes = historico.slice(-minMensagens);
  let resumoAntigas = antigas.map(m => m.content).join(" ").replace(/\s+/g, " ").slice(0, 200);
  return `Resumo anterior: ${resumoAntigas}...\n` +
    recentes.map(m => `${m.role === "user" ? "Usuário" : "Douglas"}: ${m.content}`).join("\n");
}

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
        
        if (data.tipo === 'clear') {
          mem = {}
          broadcast({
            tipo: "msg",
            nome: "Sistema",
            texto: `${data.nome} Resetou a IA`
          })
          return
        }
        
        if (data.tipo === "ia") {
          addMem(data.nome, "user", data.texto)
          let contexto = addContext(data.nome)
          contexto += `\nASS: ${data.nome}`
          async function chamarIA(prompt) {
            let CO = `Responda em pt-br: ${prompt}`
          let api = await fetch(`https://shizuku-apis.shop/api/ias/gpt?texto=${CO}&apitoken=Loon-dev`)
          let resultado = await api.json()
          let resposta = await resultado.resultado.data[0].resposta
          return resposta
          }
          let IA = await chamarIA(contexto)
          addMem(data.nome, "Douglas", IA)
          broadcast({
            tipo: "ia",
            nome: "Assistente Douglas",
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
