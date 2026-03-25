/* global getAccessToken, ensureAuth */

async function fetchAllVmStatus() {
  // No auth needed for viewing status
  var response = await fetch('/api/vm/all-status');
  if (!response.ok) {
    var err = await response.json().catch(function () { return {}; });
    throw new Error(err.error || 'Status fetch failed: ' + response.status);
  }
  return response.json();
}

async function vmAction(action, vmName, rg, extraParams) {
  // Ensure user is authenticated before performing actions
  var authed = await ensureAuth();
  if (!authed) throw new Error('Authentication required');

  var token = await getAccessToken();
  var params = new URLSearchParams({ vm_name: vmName, resource_group: rg });
  if (extraParams) {
    Object.entries(extraParams).forEach(function (entry) { params.set(entry[0], entry[1]); });
  }
  var response = await fetch('/api/vm/' + action + '?' + params, {
    headers: { 'Authorization': 'Bearer ' + token },
  });
  var data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || 'Action failed: ' + response.status);
  return data;
}
