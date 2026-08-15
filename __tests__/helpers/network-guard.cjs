"use strict";

const fs = require("node:fs");
const dns = require("node:dns");
const http = require("node:http");
const http2 = require("node:http2");
const https = require("node:https");
const net = require("node:net");
const tls = require("node:tls");
const dgram = require("node:dgram");

const loadedLog = process.env.WTFM_NETWORK_GUARD_LOADED_LOG;
if (loadedLog) {
  fs.appendFileSync(loadedLog, `loaded:${process.argv[1] ?? ""}\n`, "utf-8");
}

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
http2.connect = blocked("http2.connect");
https.request = blocked("https.request");
https.get = blocked("https.get");
net.connect = blocked("net.connect");
net.createConnection = blocked("net.createConnection");
net.Socket.prototype.connect = blocked("net.Socket.connect");
tls.connect = blocked("tls.connect");
dgram.createSocket = blocked("dgram.createSocket");
dns.lookup = blocked("dns.lookup");
dns.resolve = blocked("dns.resolve");
// Subprocess egress is outside this in-process Node API guard. The docs runner
// spawns only the local Git executable and the reviewed Eleventy entry point.
for (const name of Object.keys(dns.promises)) {
  if (typeof dns.promises[name] === "function") {
    dns.promises[name] = blocked(`dns.promises.${name}`);
  }
}
