import http from 'http';
import express from 'express';
import WebSocket from 'ws';
// import * as fs from 'fs';

const rooms = new Map();
const clients = new Map();

/****************************************************************
 * clients and rooms
 */

class Client {
  constructor(socket) {
    this.socket = socket;
    this.room = null;
    this.id = null;
    this.dataSubscriptions = new Set();
  }

  set(room, id) {
    this.room = room
    this.id = id;
  }

  reset() {
    this.socket = null;
    this.room = null;
    this.id = null;
    this.dataSubscriptions = null;
  }

  sendMessage(...message) {
    sendMessage(this.socket, message);
  }

  sendError(...message) {
    sendMessage(this.socket, ['error', message]);
  }

  sendOk() {
    sendMessage(this.socket, ['ok']);
  }
}

class Room {
  constructor(name) {
    const room = rooms.get(name);
    
    if (room) {
      return room;
    } 

    this.name = name;
    this.clientList = [];
    this.clientsById = [];

    this.dataListeners = new Map();
    this.anyDataListeners = new Set();

    this.data = {};

    rooms.set(name, this);
  }

  addClient(client) {
    const clientId = this.registerClient(client);

    this.clientList.push(client);
    client.set(this, clientId);

    return clientId;
  }

  removeClient(client) {
    const clientId = this.deregisterClient(client);

    if (clientId !== null) {
      const clientIndex = this.clientList.indexOf(client);

      this.clientList.splice(clientIndex, 1);

      this.removeDataListener(client);
      this.callDataListeners('client-exit', client.id);

      const clientCount = this.clientList.length;
      this.callDataListeners('client-count', clientCount);

      if (clientCount === 0) {
        this.reset();
        rooms.delete(this.name);
      }
    }

    return clientId;
  }

  removeAllClients() {
    for (let client of this.clientList) {
      client.socket.close();
      client.reset();
    }

    this.clientList = [];
    this.clientsById = [];

    this.dataListeners.clear();
    this.anyDataListeners.clear();
  }

  reset() {
    this.removeAllClients();
    this.data = {};
  }

  registerClient(client) {
    const clientsById = this.clientsById;
    let clientId = 0;
    let clientAtId = clientsById[0];

    while (clientAtId && clientId < this.clientsById.length) {
      clientId++;
      clientAtId = clientsById[clientId];
    }

    clientsById[clientId] = client;
    return clientId;
  }

  deregisterClient(client) {
    const clientsById = this.clientsById;
    const clientId = clientsById.indexOf(client);

    if (clientId >= 0 && clientsById[clientId]) {
      clientsById[clientId] = null;

      // tidy-up list
      let lastIndex = clientsById.length - 1;
      while (lastIndex >= 0 && clientsById[lastIndex] === null) {
        clientsById.length = lastIndex;
        lastIndex--;
      }

      return clientId;
    }

    return null;
  }

  getClientIds() {
    const clientIds = [];

    for (let client of this.clientList) {
      clientIds.push(client);
    }

    return clientIds;
  }

  getClientCount() {
    return this.clientList.length;
  }

  setData(key, value) {
    this.data[key] = value;
  }

  getData(key) {
    return this.data[key];
  }

  sendDataToClient(client) {
    const data = this.data;

    for (let key in data) {
      const value = data[key];
      client.sendMessage(key, value);
    }
  }

  addDataListener(client, key) {
    if (key === '*') {
      this.anyDataListeners.add(client);
    } else {
      let listeners = this.dataListeners.get(key);

      if (!listeners) {
        listeners = new Set();
        this.dataListeners.set(key, listeners);
      }

      listeners.add(client);
      client.dataSubscriptions.add(key);
    }
  }

  removeDataListener(client, key = null) {
    if (key === null) {
      this.anyDataListeners.delete(client);

      // remove client as listener of all keys
      for (let key of client.dataSubscriptions) {
        const listeners = this.dataListeners.get(key);
        listeners.delete(client);
      }

      client.dataSubscriptions.clear();
    } else if (key === '*') {
      this.anyDataListeners.delete(client);
    } else {
      const listeners = this.dataListeners.get(key);
      listeners.delete(client);
      client.dataSubscriptions.delete(key);
    }
  }

  callDataListeners(key, value, exclude = null) {
    const listeners = this.dataListeners.get(key);

    if (listeners) {
      for (let client of listeners) {
        if (client !== exclude) {
          client.sendMessage(key, value);
        }
      }
    }

    for (let client of this.anyDataListeners) {
      if (client !== exclude) {
        client.sendMessage(key, value);
      }
    }
  }

  sendMessageToClientById(sender, clientId, message) {
    if (clientId !== sender.id) {
      const clientsById = this.clientsById;
      const client = clientsById[clientId];

      if (client) {
        client.sendMessage(...message);
      }
    }
  }

  sendMessageToOtherClients(sender, message) {
    for (let client of this.clientList) {
      if (client !== sender) {
        client.sendMessage(...message);
      }
    }
  }
}

function resetAll() {
  for (let { socket, client } of clients) {
    client.reset();
    socket.close();
  }

  clients.clear();
  rooms.clear();
}

/****************************************************************
 * http server
 */
// mkdir sslcert
// openssl req -x509 -sha256 -nodes -days 365 -newkey rsa:2048 -keyout sslcert/selfsigned.key -out sslcert/selfsigned.crt
// const key = fs.readFileSync('sslcert/selfsigned.key', 'utf8');
// const cert = fs.readFileSync('sslcert/selfsigned.crt', 'utf8');
// const credentials = { key, cert };
// const httpServer = https
//   .createServer(credentials, app)
//   .listen(httpPort, () => console.log(`server listening on port ${httpPort}`));

const httpPort = Number(process.env.PORT) || 3000;
const httpHost = '0.0.0.0';
const app = express();

const httpServer = http
  .createServer(app)
  .listen(httpPort, httpHost, () => console.log(`server listening on ${httpHost}:${httpPort}`));

app.use(express.static('.'));

/****************************************************************
 * websoket server
 */
const webSocketServer = new WebSocket.Server({ server: httpServer });

// listen to new web socket connections
webSocketServer.on('connection', (socket, req) => {
  const client = new Client(socket);

  clients.set(socket, client);

  socket.on('message', (data) => {
    if (data.length > 0) {
      const incoming = JSON.parse(data);
      const selector = incoming[0];

      switch (selector) {
        // room client ///////////////////////////////////////////////////
        case 'enter-room': {
          const name = incoming[1];
          const room = new Room(name);

          const clientId = room.addClient(client);
          client.sendMessage('client-id', clientId);

          room.callDataListeners('client-enter', clientId, client);

          const clientCount = room.getClientCount();
          room.callDataListeners('client-count', clientCount, client);

          break;
        }

        case 'exit-room': {
          const room = client.room;

          room.removeClient(client);

          room.callDataListeners('client-exit', clientId);

          const clientCount = room.getClientCount();
          room.callDataListeners('client-count', clientCount, client);

          break;
        }

        case 'get-client-ids': {
          const room = client.room;

          if (room) {
            const clientIds = room.getClientIds();
            client.sendMessage('client-ids', clientIds);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'subscribe-client-enter-exit': {
          const room = client.room;

          if (room) {
            for (let other of this.clientList) {
              if (other !== client) {
                client.sendMessage('client-enter', other.id);
              }
            }

            room.addDataListener(client, 'client-enter');
            room.addDataListener(client, 'client-exit');
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'unsubscribe-clients': {
          const room = client.room;

          if (room) {
            room.removeDataListener(client, 'client-enter');
            room.removeDataListener(client, 'client-exit');
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'get-client-count': {
          const room = client.room;

          if (room) {
            const clientCount = room.getClientCount();
            client.sendMessage('client-count', clientCount);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'subscribe-client-count': {
          const room = client.room;

          if (room) {
            const clientCount = room.getClientCount();
            client.sendMessage('client-count', clientCount);

            room.addDataListener(client, 'client-count');
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'unsubscribe-client-count': {
          const room = client.room;

          if (room) {
            room.removeDataListener(client, 'client-count');
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        // messages ///////////////////////////////////////////////////
        case 'send-message': {
          const room = client.room;

          if (room) {
            const clientId = incoming[1];
            const message = incoming[2];
            room.sendMessageToClientById(client, clientId, message);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'broadcast-message': {
          const room = client.room;

          if (room) {
            const message = incoming[1];
            room.sendMessageToOtherClients(client, message);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        // data ///////////////////////////////////////////////////
        case 'set-data': {
          const room = client.room;

          if (room) {
            const key = incoming[1];
            const value = incoming[2];
            room.setData(key, value);
            room.callDataListeners(key, value, client);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'get-data': {
          const room = client.room;

          if (room) {
            const key = incoming[1];
            const value = room.getData(key);
            client.sendMessage(key, value);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'subscribe-data': {
          const room = client.room;

          if (room) {
            const key = incoming[1];
            room.sendDataToClient(client);
            room.addDataListener(client, key);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        case 'unsubscribe-data': {
          const room = client.room;

          if (room) {
            const key = incoming[1];
            room.removeDataListener(client, key);
          } else {
            client.sendError('no-room', room.name);
          }

          break;
        }

        default:
          client.sendError('unknown-message', selector);
          break;
      }
    }
  });

  socket.on('close', () => {
    const room = client.room;

    if (room !== null) {
      room.removeClient(client);
    }
  });
});

function sendMessage(socket, message) {
  const str = JSON.stringify(message);
  socket.send(str);
}
