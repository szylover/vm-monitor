const net = require("net");

const VMS = [
  { name: "vm-hk", ip: "20.2.113.93", port: 1700, location: "East Asia" },
  { name: "vm-us", ip: "20.109.147.148", port: 16158, location: "West US 2" },
];

function tcpProbe(host, port, timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeout);
    socket.on("connect", () => {
      const ms = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, ms });
    });
    socket.on("timeout", () => { socket.destroy(); resolve({ ok: false, ms: -1 }); });
    socket.on("error", () => { socket.destroy(); resolve({ ok: false, ms: -1 }); });
    socket.connect(port, host);
  });
}

module.exports = async function (context, req) {
  const results = await Promise.all(
    VMS.map(async (vm) => {
      const probe = await tcpProbe(vm.ip, vm.port);
      return {
        name: vm.name,
        location: vm.location,
        ip: vm.ip,
        vmStatus: probe.ok ? "running" : "unreachable",
        v2rayPort: vm.port,
        v2rayStatus: probe.ok ? "ok" : "down",
        responseTime: probe.ms,
      };
    })
  );

  context.res = {
    headers: { "Content-Type": "application/json" },
    body: { timestamp: new Date().toISOString(), vms: results },
  };
};
