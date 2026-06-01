const net = require("net");
const { DefaultAzureCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");

const SUBSCRIPTION_ID = "ae965a77-d1bf-4624-959d-1803127e59c7";

const VMS = [
  { name: "vm-hk", rg: "VM-HK", ip: "20.2.113.93", port: 1700, location: "East Asia" },
  { name: "vm-us", rg: "VM-US", ip: "20.109.147.148", port: 16158, location: "West US 2" },
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

async function getVmPowerState(client, rg, name) {
  try {
    const view = await client.virtualMachines.instanceView(rg, name);
    const powerStatus = view.statuses.find((s) => s.code.startsWith("PowerState/"));
    return powerStatus ? powerStatus.code.replace("PowerState/", "") : "unknown";
  } catch {
    return "error";
  }
}

module.exports = async function (context, req) {
  const credential = new DefaultAzureCredential();
  const computeClient = new ComputeManagementClient(credential, SUBSCRIPTION_ID);

  const results = await Promise.all(
    VMS.map(async (vm) => {
      const [powerState, probe] = await Promise.all([
        getVmPowerState(computeClient, vm.rg, vm.name),
        tcpProbe(vm.ip, vm.port),
      ]);
      return {
        name: vm.name,
        location: vm.location,
        ip: vm.ip,
        vmStatus: powerState,
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
