/* global currentAccount, canControl, fetchAllVmStatus, vmAction, CONFIG */

let refreshTimer = null;
let currentExtendVm = null;

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
      setTimeout(refreshAll, 3000);
    } catch (err) {
      showToast('Failed to ' + action + ' ' + vmName + ': ' + err.message, 'error');
    }
  };
  document.getElementById('confirm-modal').style.display = 'flex';
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
