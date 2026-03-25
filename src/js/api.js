/* global getAccessToken */

async function fetchAllVmStatus() {
  const token = await getAccessToken();
  const response = await fetch('/api/vm/all-status', {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Status fetch failed: ${response.status}`);
  }
  return response.json();
}

async function vmAction(action, vmName, rg, extraParams) {
  const token = await getAccessToken();
  const params = new URLSearchParams({ vm_name: vmName, resource_group: rg });
  if (extraParams) {
    Object.entries(extraParams).forEach(([k, v]) => params.set(k, v));
  }
  const response = await fetch(`/api/vm/${action}?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Action failed: ${response.status}`);
  return data;
}
