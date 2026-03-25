/* global currentAccount, canControl, fetchAllVmStatus, vmAction, CONFIG */

let refreshTimer = null;
let currentExtendVm = null;
// Track VMs that are transitioning (starting/stopping) for fast polling
var pendingVms = {}; // { vmName: { action: 'start'|'stop', pollTimer: id } }

async function refreshAll() {
  if (!currentAccount) return;

  try {
    document.getElementById('last-refresh').textContent = 'Refreshing...';
    const vms = await fetchAllVmStatus();
    renderVmGrid(vms);
    document.getElementById('last-refresh').textContent =
      'Last refreshed: ' + new Date().toLocaleTimeString();
  } catch (err) {
    console.error('Refresh failed:', err);
    showToast('Failed to refresh: ' + err.message, 'error');
  }

  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(refreshAll, CONFIG.refreshInterval);
}

function renderVmGrid(vms) {
  const grid = document.getElementById('vm-grid');
  grid.innerHTML = vms.map(function (vm) {
    const stateClass = getStateClass(vm.powerState);
    const stateLabel = formatPowerState(vm.powerState);
    const showActions = !vm.alwaysOn && canControl(vm.name);
    const isRunning = vm.powerState && vm.powerState.toLowerCase().includes('running');
    const isStopped = vm.powerState && (vm.powerState.toLowerCase().includes('deallocated') || vm.powerState.toLowerCase().includes('stopped'));

    let shutdownInfo;
    if (vm.alwaysOn) {
      shutdownInfo = 'Always on';
    } else if (vm.autoShutdown && vm.autoShutdown.enabled) {
      shutdownInfo = 'Shutdown: ' + vm.autoShutdown.display_time +
        ' (' + formatMinutes(vm.autoShutdown.minutes_until_shutdown) + ')';
    } else {
      shutdownInfo = 'No auto-shutdown';
    }

    // Find IP from config
    const vmConfig = CONFIG.vms.find(function (v) { return v.name === vm.name; });
    const ip = vmConfig ? vmConfig.ip : null;

    let actionsHtml = '';
    if (showActions) {
      let buttons = '';
      if (isStopped) {
        buttons += '<button class="btn-start" onclick="confirmAction(\'start\', \'' +
          vm.name + '\', \'' + vm.resourceGroup + '\')">Start</button>';
      } else if (isRunning) {
        buttons += '<button class="btn-stop" onclick="confirmAction(\'stop\', \'' +
          vm.name + '\', \'' + vm.resourceGroup + '\')">Stop</button>';
      }
      buttons += '<button class="btn-extend" onclick="openExtendModal(\'' +
        vm.name + '\', \'' + vm.resourceGroup + '\')">Extend</button>';
      actionsHtml = '<div class="vm-actions">' + buttons + '</div>';
    }

    return '<div class="vm-card ' + stateClass + '">' +
      '<div class="vm-header">' +
        '<span class="status-dot ' + stateClass + '"></span>' +
        '<h3>' + vm.name + '</h3>' +
      '</div>' +
      '<div class="vm-details">' +
        '<span class="vm-state">' + stateLabel + '</span>' +
        '<span class="vm-shutdown">' + shutdownInfo + '</span>' +
        (ip ? '<span class="vm-ip">' + ip + '</span>' : '') +
      '</div>' +
      actionsHtml +
    '</div>';
  }).join('');
}

function getStateClass(powerState) {
  if (!powerState) return 'state-unknown';
  var s = powerState.toLowerCase();
  if (s.includes('running')) return 'state-running';
  if (s.includes('deallocated') || s.includes('stopped')) return 'state-stopped';
  return 'state-transitioning';
}

function formatPowerState(state) {
  if (!state) return 'Unknown';
  return state.replace('VM ', '');
}

function formatMinutes(minutes) {
  if (minutes == null || minutes < 0) return '';
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

// -- Confirmation modal --
function confirmAction(action, vmName, rg) {
  document.getElementById('confirm-message').textContent =
    'Are you sure you want to ' + action + ' ' + vmName + '?';
  document.getElementById('confirm-yes').onclick = async function () {
    closeModal();
    try {
      await vmAction(action, vmName, rg);
      showToast(action + ' ' + vmName + ': accepted', 'success');
      // Mark VM as transitioning and start fast polling
      setPendingState(vmName, action);
    } catch (err) {
      showToast('Failed to ' + action + ' ' + vmName + ': ' + err.message, 'error');
    }
  };
  document.getElementById('confirm-modal').style.display = 'flex';
}

function setPendingState(vmName, action) {
  // Clear any existing poll for this VM
  if (pendingVms[vmName]) {
    clearInterval(pendingVms[vmName].pollTimer);
  }

  var expectedState = action === 'start' ? 'running' : 'deallocated';
  var label = action === 'start' ? 'Starting...' : 'Stopping...';

  // Immediately update the card to show transitioning state
  pendingVms[vmName] = { action: action };
  updateCardState(vmName, label, 'state-transitioning');

  // Poll every 5 seconds until state changes
  var pollCount = 0;
  pendingVms[vmName].pollTimer = setInterval(async function () {
    pollCount++;
    if (pollCount > 36) { // max 3 minutes of polling
      clearInterval(pendingVms[vmName].pollTimer);
      delete pendingVms[vmName];
      showToast(vmName + ': ' + action + ' is taking longer than expected', 'info');
      refreshAll();
      return;
    }
    try {
      var vms = await fetchAllVmStatus();
      var vm = vms.find(function (v) { return v.name === vmName; });
      if (vm && vm.powerState && vm.powerState.toLowerCase().includes(expectedState)) {
        // Reached target state
        clearInterval(pendingVms[vmName].pollTimer);
        delete pendingVms[vmName];
        showToast(vmName + ' is now ' + expectedState, 'success');
        renderVmGrid(vms);
        document.getElementById('last-refresh').textContent =
          'Last refreshed: ' + new Date().toLocaleTimeString();
      } else if (vm) {
        // Still transitioning — update all cards with fresh data but keep this one as transitioning
        renderVmGrid(vms);
        updateCardState(vmName, label, 'state-transitioning');
        document.getElementById('last-refresh').textContent =
          'Last refreshed: ' + new Date().toLocaleTimeString();
      }
    } catch (err) {
      // Ignore poll errors, will retry
    }
  }, 5000);
}

function updateCardState(vmName, stateLabel, stateClass) {
  // Find the card for this VM and update its state display
  var cards = document.querySelectorAll('.vm-card');
  cards.forEach(function (card) {
    var h3 = card.querySelector('h3');
    if (h3 && h3.textContent === vmName) {
      // Update card border color
      card.className = 'vm-card ' + stateClass;
      // Update status dot
      var dot = card.querySelector('.status-dot');
      if (dot) dot.className = 'status-dot ' + stateClass;
      // Update state label
      var stateSpan = card.querySelector('.vm-state');
      if (stateSpan) stateSpan.textContent = stateLabel;
      // Remove action buttons while transitioning
      var actions = card.querySelector('.vm-actions');
      if (actions) actions.innerHTML = '<span class="vm-transitioning-label">' + stateLabel + '</span>';
    }
  });
}

function closeModal() {
  document.getElementById('confirm-modal').style.display = 'none';
}

// -- Extend modal --
function openExtendModal(vmName, rg) {
  currentExtendVm = { name: vmName, rg: rg };
  document.getElementById('extend-vm-name').textContent = vmName;
  document.getElementById('custom-minutes').value = '';
  document.getElementById('extend-modal').style.display = 'flex';
}

function closeExtendModal() {
  document.getElementById('extend-modal').style.display = 'none';
  currentExtendVm = null;
}

async function doExtend(hours) {
  if (!currentExtendVm) return;
  var vm = currentExtendVm;
  closeExtendModal();
  try {
    var result = await vmAction('extend-shutdown', vm.name, vm.rg, { hours: hours });
    showToast(vm.name + ': shutdown extended to ' + result.new_shutdown, 'success');
    setTimeout(refreshAll, 1000);
  } catch (err) {
    showToast('Failed to extend: ' + err.message, 'error');
  }
}

async function doExtendCustom() {
  var minutes = parseInt(document.getElementById('custom-minutes').value);
  if (!minutes || minutes < 15 || minutes > 720) {
    showToast('Enter 15-720 minutes', 'error');
    return;
  }
  if (!currentExtendVm) return;
  var vm = currentExtendVm;
  closeExtendModal();
  try {
    var result = await vmAction('extend-shutdown', vm.name, vm.rg, { minutes: minutes });
    showToast(vm.name + ': shutdown extended to ' + result.new_shutdown, 'success');
    setTimeout(refreshAll, 1000);
  } catch (err) {
    showToast('Failed to extend: ' + err.message, 'error');
  }
}

// -- Toast notifications --
function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 5000);
}

// Close modals on backdrop click
document.addEventListener('click', function (e) {
  if (e.target.id === 'confirm-modal') closeModal();
  if (e.target.id === 'extend-modal') closeExtendModal();
});

// Close modals on Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    closeModal();
    closeExtendModal();
  }
});
