import net from 'node:net'
import tls from 'node:tls'
import dgram from 'node:dgram'
import dns from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { syncBuiltinESMExports } from 'node:module'
function deny() {throw new Error('OFFLINE_NETWORK_DENIED')}
globalThis.fetch=deny
net.Socket.prototype.connect=deny
net.Server.prototype.listen=deny
net.connect=deny
net.createConnection=deny
tls.connect=deny
dgram.Socket.prototype.bind=deny
dgram.Socket.prototype.send=deny
http.request=deny; http.get=deny; https.request=deny; https.get=deny
for(const target of [dns,dns.promises]) for(const name of Object.keys(target)) {
  if((name==='lookup' || name==='lookupService' || name.startsWith('resolve') || name==='reverse') && typeof target[name]==='function') target[name]=deny
}
syncBuiltinESMExports()
