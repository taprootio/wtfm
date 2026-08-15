"use strict";

const fs = require("node:fs");
const dns = require("node:dns");
const http = require("node:http");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const dgram = require("node:dgram");

function blocked(api) {
  return function networkAttemptBlocked() {
    const log = process.env.WTFM_NETWORK_GUARD_LOG;
    if (log) fs.appendFileSync(log, `${api}\n`, "utf-8");
    throw new Error(`Network access blocked during WTFM docs build: ${api}`);
  };
}

globalThis.fetch = blocked("fetch");
http.request = blocked("http.request");
http.get = blocked("http.get");
https.request = blocked("https.request");
https.get = blocked("https.get");
net.connect = blocked("net.connect");
net.createConnection = blocked("net.createConnection");
net.Socket.prototype.connect = blocked("net.Socket.connect");
tls.connect = blocked("tls.connect");
dgram.createSocket = blocked("dgram.createSocket");
dns.lookup = blocked("dns.lookup");
dns.resolve = blocked("dns.resolve");
for (const name of Object.keys(dns.promises)) {
  if (typeof dns.promises[name] === "function") {
    dns.promises[name] = blocked(`dns.promises.${name}`);
  }
}
