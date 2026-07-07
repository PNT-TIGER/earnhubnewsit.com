function watchAd(adId, btn) {
  btn.disabled = true;
  btn.textContent = 'Loading...';

  var modal = document.getElementById('adModal');
  var timerEl = document.getElementById('timerCount');
  var progressEl = document.getElementById('adProgress');
  var titleEl = document.getElementById('adModalTitle');

  modal.style.display = 'flex';
  titleEl.textContent = 'Watching Ad...';

  var seconds = 15;
  timerEl.textContent = seconds;
  progressEl.style.width = '0%';

  var interval = setInterval(function() {
    seconds--;
    timerEl.textContent = seconds;
    progressEl.style.width = ((15 - seconds) / 15 * 100) + '%';

    if (seconds <= 0) {
      clearInterval(interval);
      timerEl.textContent = '...';
      titleEl.textContent = 'Completing...';

      fetch('/ads/' + adId + '/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        modal.style.display = 'none';
        if (data.success) {
          var card = document.getElementById('ad-' + adId);
          if (card) {
            var icon = card.querySelector('.ad-icon');
            if (icon) {
              icon.className = 'ad-icon ad-done';
              icon.innerHTML = '&#10003;';
            }
            btn.parentNode.innerHTML = '<span class="badge badge-success">Done</span>';
          }
          var balEls = document.querySelectorAll('.balance-display');
          balEls.forEach(function(el) { el.textContent = '$' + data.balance.toFixed(4); });
          showToast('Earned $' + data.earned.toFixed(4) + '!');
        } else {
          showToast(data.message || 'Failed');
          btn.disabled = false;
          btn.textContent = 'Watch';
        }
      })
      .catch(function() {
        modal.style.display = 'none';
        showToast('Error occurred');
        btn.disabled = false;
        btn.textContent = 'Watch';
      });
    }
  }, 1000);
}

function completeTask(taskId, btn) {
  btn.disabled = true;
  btn.textContent = 'Loading...';

  fetch('/tasks/' + taskId + '/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      var card = document.getElementById('task-' + taskId);
      if (card) {
        var icon = card.querySelector('.task-icon');
        if (icon) {
          icon.className = 'task-icon task-done';
          icon.innerHTML = '&#10003;';
        }
        btn.parentNode.innerHTML = '<span class="badge badge-success">Done</span>';
      }
      var balEls = document.querySelectorAll('.balance-display');
      balEls.forEach(function(el) { el.textContent = '$' + data.balance.toFixed(4); });
      showToast('Earned $' + data.earned.toFixed(4) + '!');
    } else {
      showToast(data.message || 'Failed');
      btn.disabled = false;
      btn.textContent = 'Complete';
    }
  })
  .catch(function() {
    showToast('Error occurred');
    btn.disabled = false;
    btn.textContent = 'Complete';
  });
}

function claimGiftCode() {
  var input = document.getElementById('giftCodeInput');
  var result = document.getElementById('giftResult');
  var code = input.value.trim();

  if (!code) {
    result.innerHTML = '<span style="color:#ff4757">Please enter a gift code</span>';
    return;
  }

  fetch('/giftcode/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: code })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (data.success) {
      result.innerHTML = '<span style="color:#00d4aa">Gift code claimed! +$' + data.amount.toFixed(4) + '</span>';
      input.value = '';
      setTimeout(function() { location.reload(); }, 1500);
    } else {
      result.innerHTML = '<span style="color:#ff4757">' + data.message + '</span>';
    }
  })
  .catch(function() {
    result.innerHTML = '<span style="color:#ff4757">Error claiming code</span>';
  });
}

function copyRefCode() {
  var code = document.getElementById('refCode').textContent;
  navigator.clipboard.writeText(code).then(function() {
    showToast('Referral code copied!');
  }).catch(function() {
    var temp = document.createElement('textarea');
    temp.value = code;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    showToast('Referral code copied!');
  });
}

function copyRefLink() {
  var link = document.getElementById('refLink').value;
  navigator.clipboard.writeText(link).then(function() {
    showToast('Referral link copied!');
  }).catch(function() {
    var temp = document.createElement('textarea');
    temp.value = link;
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
    showToast('Referral link copied!');
  });
}

function showToast(msg) {
  var existing = document.querySelector('.toast-msg');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = msg;
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#00d4aa;color:#000;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;z-index:1000;animation:fadeIn 0.3s ease';
  document.body.appendChild(toast);
  setTimeout(function() { toast.remove(); }, 3000);
}
