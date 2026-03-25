const { VM_WHITELIST, STATUS_ONLY_VMS } = require('../shared/config');

module.exports = async function (context, req) {
  // Require authentication
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    context.res = {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authorization required' }),
    };
    return;
  }

  const baseUrl = process.env.VM_TASK_BASE_URL;
  const functionKey = process.env.VM_TASK_FUNCTION_KEY;

  // Build parallel requests for all VMs: status + shutdown-schedule
  const vmEntries = Object.entries(VM_WHITELIST);
  const promises = vmEntries.map(async ([vmName, rg]) => {
    const statusUrl = `${baseUrl}/status?code=${encodeURIComponent(functionKey)}&vm_name=${encodeURIComponent(vmName)}&resource_group=${encodeURIComponent(rg)}`;
    const scheduleUrl = `${baseUrl}/shutdown-schedule?code=${encodeURIComponent(functionKey)}&vm_name=${encodeURIComponent(vmName)}&resource_group=${encodeURIComponent(rg)}`;

    const [statusRes, scheduleRes] = await Promise.allSettled([
      fetch(statusUrl, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(scheduleUrl), // shutdown-schedule doesn't need Entra token
    ]);

    let powerState = 'Unknown';
    if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
      const data = await statusRes.value.json();
      powerState = data.PowerState || 'Unknown';
    }

    let autoShutdown = null;
    if (scheduleRes.status === 'fulfilled' && scheduleRes.value.ok) {
      const data = await scheduleRes.value.json();
      autoShutdown = data.auto_shutdown || null;
    }

    return {
      name: vmName,
      resourceGroup: rg,
      powerState,
      alwaysOn: STATUS_ONLY_VMS.includes(vmName),
      autoShutdown,
    };
  });

  try {
    const results = await Promise.all(promises);
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(results),
    };
  } catch (err) {
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Failed to fetch VM statuses: ${err.message}` }),
    };
  }
};
