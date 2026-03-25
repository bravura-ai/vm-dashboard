const { VM_WHITELIST, PROTECTED_ACTIONS, isAuthorized } = require('../shared/config');

const VALID_ACTIONS = ['status', 'start', 'stop', 'shutdown-schedule', 'extend-shutdown'];
// Actions that require Entra ID token forwarded to vm-task
const ENTRA_ACTIONS = ['start', 'stop', 'extend-shutdown'];

module.exports = async function (context, req) {
  const action = context.bindingData.action;

  // 1. Validate action
  if (!VALID_ACTIONS.includes(action)) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Invalid action: ${action}` }),
    };
    return;
  }

  // 2. Extract and validate Bearer token
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    context.res = {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Authorization header required' }),
    };
    return;
  }

  // 3. Decode JWT to get user email (no signature verification — vm-task validates the token)
  let userEmail;
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    userEmail = (payload.preferred_username || payload.upn || '').toLowerCase();
  } catch (e) {
    context.res = {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid token' }),
    };
    return;
  }

  if (!userEmail) {
    context.res = {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Token missing user email claim' }),
    };
    return;
  }

  // 4. Validate VM name against whitelist
  const vmName = req.query.vm_name;
  const resourceGroup = req.query.resource_group;

  if (!vmName || !resourceGroup) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Required: vm_name, resource_group' }),
    };
    return;
  }

  if (!VM_WHITELIST[vmName] || VM_WHITELIST[vmName] !== resourceGroup) {
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Unknown VM: ${vmName}` }),
    };
    return;
  }

  // 5. Authorization check for protected actions
  if (PROTECTED_ACTIONS.includes(action) && !isAuthorized(userEmail, vmName, action)) {
    context.res = {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `User ${userEmail} not authorized to ${action} VM ${vmName}` }),
    };
    return;
  }

  // 6. Build target URL
  const baseUrl = process.env.VM_TASK_BASE_URL;
  const functionKey = process.env.VM_TASK_FUNCTION_KEY;

  let targetUrl = `${baseUrl}/${action}?code=${encodeURIComponent(functionKey)}&vm_name=${encodeURIComponent(vmName)}&resource_group=${encodeURIComponent(resourceGroup)}`;

  // Forward additional query params for extend-shutdown
  if (action === 'extend-shutdown') {
    if (req.query.hours) targetUrl += `&hours=${encodeURIComponent(req.query.hours)}`;
    if (req.query.minutes) targetUrl += `&minutes=${encodeURIComponent(req.query.minutes)}`;
  }

  // 7. Forward request to vm-task
  const fetchOptions = { method: 'GET', headers: {} };

  // Forward Bearer token for Entra-protected endpoints
  if (ENTRA_ACTIONS.includes(action)) {
    fetchOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    const body = await response.text();

    context.res = {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
      body: body,
    };
  } catch (err) {
    context.res = {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Upstream error: ${err.message}` }),
    };
  }
};
