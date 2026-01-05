
/* Clean, robust, self-contained JavaScript for split-bill-calculator.html
   - Drop this code into a <script> tag (not type="module") placed before </body>,
     or save as an external JS file and include via a normal <script src="..."></script>.
   - Uses safe DOM methods (no unescaped `</script>` inside template literals).
   - All functions referenced by your HTML onclick attributes are defined as global functions.
   - Defensive checks added to prevent SyntaxError, division-by-zero, and undefined references.
*/

/* ===== Helpers ===== */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatCurrency(value) {
  const n = Number(value) || 0;
  return n.toFixed(2);
}

/* ===== State ===== */
let people = [];
let items = [];
let personIdCounter = 1;
let itemIdCounter = 1;
let currentSplitMethod = 'equal'; // 'equal' | 'custom'
let currentTipType = 'percent'; // 'percent' | 'amount'
let lastResults = null;

/* ===== UI State Functions (global) ===== */
function toggleStep(stepNumber) {
  const content = document.getElementById(`step${stepNumber}Content`);
  const header = content ? content.previousElementSibling : null;
  if (!content || !header) return;
  const chevron = header.querySelector('.step-chevron');
  const isOpen = content.classList.contains('open');

  if (isOpen) {
    content.classList.remove('open');
    chevron && chevron.classList.remove('rotated');
    header.setAttribute('aria-expanded', 'false');
  } else {
    content.classList.add('open');
    chevron && chevron.classList.add('rotated');
    header.setAttribute('aria-expanded', 'true');
    if (stepNumber === 1 && document.getElementById('billTotal') && document.getElementById('billTotal').value) {
      header.classList.add('completed');
    }
  }
}

function toggleAdvanced() {
  const content = document.getElementById('advancedContent');
  const toggle = content ? content.previousElementSibling : null;
  if (!content) return;
  const wasOpen = content.classList.contains('open');
  if (wasOpen) {
    content.classList.remove('open');
    toggle && toggle.setAttribute('aria-expanded', 'false');
  } else {
    content.classList.add('open');
    toggle && toggle.setAttribute('aria-expanded', 'true');
  }
}

function toggleStickyDetails() {
  const details = document.getElementById('stickyDetails');
  const header = details ? details.previousElementSibling : null;
  const btn = header ? header.querySelector('.sticky-collapse-btn') : null;
  if (!details) return;
  const expanded = details.classList.contains('expanded');
  if (expanded) {
    details.classList.remove('expanded');
    btn && (btn.setAttribute('aria-expanded', 'false'), btn.querySelector('i') && (btn.querySelector('i').className = 'fas fa-chevron-up'));
  } else {
    details.classList.add('expanded');
    btn && (btn.setAttribute('aria-expanded', 'true'), btn.querySelector('i') && (btn.querySelector('i').className = 'fas fa-chevron-down'));
  }
}

/* ===== People Counter / Sync ===== */
function incrementPeople() {
  const countEl = document.getElementById('peopleCount');
  if (!countEl) return;
  let count = parseInt(countEl.textContent, 10) || 0;
  count++;
  countEl.textContent = count;
  syncPeopleArray();
}

function decrementPeople() {
  const countEl = document.getElementById('peopleCount');
  if (!countEl) return;
  let count = parseInt(countEl.textContent, 10) || 0;
  if (count > 1) {
    count--;
    countEl.textContent = count;
    syncPeopleArray();
  }
}

function syncPeopleArray() {
  const countEl = document.getElementById('peopleCount');
  const target = countEl ? (parseInt(countEl.textContent, 10) || 0) : people.length;
  // Ensure at least 1 person
  const targetCount = Math.max(1, target);

  while (people.length < targetCount) {
    const pid = personIdCounter++;
    people.push({ id: pid, name: `Person ${pid}`, customAmount: 0, paymentMethod: 'cash', items: [] });
  }
  while (people.length > targetCount) {
    const removed = people.pop();
    // remove references from items
    items.forEach(it => {
      if (Array.isArray(it.sharedBy)) {
        it.sharedBy = it.sharedBy.filter(id => id !== removed.id);
        if (it.sharedBy.length === 0 && people.length > 0) it.sharedBy.push(people[0].id);
      }
    });
  }

  // Update UI
  renderPeople();
  renderItems();
}

/* ===== Tip Type & Split Method ===== */
function setTipType(type) {
  currentTipType = type === 'amount' ? 'amount' : 'percent';

  const percentBtn = document.getElementById('tipPercentBtn');
  const amountBtn = document.getElementById('tipAmountBtn');
  const tipInput = document.getElementById('tipValue');
  if (!tipInput) return;

  // Reset input to avoid confusion
  tipInput.value = '';

  if (currentTipType === 'percent') {
    percentBtn && percentBtn.classList.add('active');
    amountBtn && amountBtn.classList.remove('active');
    percentBtn && percentBtn.setAttribute('aria-checked', 'true');
    amountBtn && amountBtn.setAttribute('aria-checked', 'false');

    // ✅ Placeholder for percentage
    tipInput.placeholder = 'Enter tip in percentage';
  } else {
    amountBtn && amountBtn.classList.add('active');
    percentBtn && percentBtn.classList.remove('active');
    amountBtn && amountBtn.setAttribute('aria-checked', 'true');
    percentBtn && percentBtn.setAttribute('aria-checked', 'false');

    // ✅ Placeholder for amount
    tipInput.placeholder = 'Enter tip amount in (your currency)';
  }
}


function quickSplit(method) {
  currentSplitMethod = method === 'custom' ? 'custom' : 'equal';
  const btns = document.querySelectorAll('.quick-split .quick-btn');
  btns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
  if (currentSplitMethod === 'custom') {
    if (btns[1]) { btns[1].classList.add('active'); btns[1].setAttribute('aria-pressed', 'true'); }
  } else {
    if (btns[0]) { btns[0].classList.add('active'); btns[0].setAttribute('aria-pressed', 'true'); }
  }
}

/* ===== People CRUD UI ===== */
function addPerson(name = '') {
  const pid = personIdCounter++;
  people.push({ id: pid, name: name || `Person ${pid}`, customAmount: 0, paymentMethod: 'cash', items: [] });
  const countEl = document.getElementById('peopleCount');
  if (countEl) countEl.textContent = people.length;
  renderPeople();
  renderItems();
}

function removePerson(personId) {
  if (people.length <= 1) {
    alert('At least one person is required.');
    return;
  }
  people = people.filter(p => p.id !== personId);
  const countEl = document.getElementById('peopleCount');
  if (countEl) countEl.textContent = people.length;
  items.forEach(it => {
    if (Array.isArray(it.sharedBy)) {
      it.sharedBy = it.sharedBy.filter(id => id !== personId);
      if (it.sharedBy.length === 0 && people.length > 0) it.sharedBy.push(people[0].id);
    }
  });
  renderPeople();
  renderItems();
}

function renderPeople() {
  const container = document.getElementById('peopleContainer');
  if (!container) return;
  container.innerHTML = '';

  people.forEach(person => {
    const card = document.createElement('div');
    card.className = 'person-card';

    const header = document.createElement('div');
    header.className = 'person-header';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'person-name';
    nameDiv.textContent = person.name;

    const controls = document.createElement('div');
    controls.className = 'person-controls';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'control-btn edit-btn';
    editBtn.setAttribute('title', 'Edit Name');
    editBtn.setAttribute('aria-label', `Edit ${person.name}`);
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.addEventListener('click', () => editPersonName(person.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'control-btn delete';
    delBtn.setAttribute('title', 'Remove Person');
    delBtn.setAttribute('aria-label', `Remove ${person.name}`);
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.addEventListener('click', () => removePerson(person.id));

    controls.appendChild(editBtn);
    controls.appendChild(delBtn);

    header.appendChild(nameDiv);
    header.appendChild(controls);

    const details = document.createElement('div');
    details.className = 'person-details';

    // Left: custom amount
    const left = document.createElement('div');
    const leftLabel = document.createElement('label');
    leftLabel.setAttribute('for', `customAmount${person.id}`);
    leftLabel.textContent = 'Custom Amount ($):';
    const leftInput = document.createElement('input');
    leftInput.type = 'number';
    leftInput.id = `customAmount${person.id}`;
    leftInput.className = 'person-input';
    leftInput.value = person.customAmount || 0;
    leftInput.step = '0.01';
    leftInput.placeholder = '0.00';
    leftInput.inputMode = 'decimal';
    leftInput.addEventListener('change', function () {
      updatePersonAmount(person.id, this.value);
    });
    left.appendChild(leftLabel);
    left.appendChild(leftInput);

    // Right: payment method
    const right = document.createElement('div');
    const rightLabel = document.createElement('label');
    rightLabel.setAttribute('for', `payment${person.id}`);
    rightLabel.textContent = 'Payment Method:';
    const select = document.createElement('select');
    select.id = `payment${person.id}`;
    select.className = 'person-input';
    ['cash', 'card', 'venmo', 'paypal', 'zelle'].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
      if (person.paymentMethod === opt) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', function () {
      updatePersonPayment(person.id, this.value);
      renderPeople();
      renderItems();
    });
    right.appendChild(rightLabel);
    right.appendChild(select);

    details.appendChild(left);
    details.appendChild(right);

    card.appendChild(header);
    card.appendChild(details);

    container.appendChild(card);
  });
}

function editPersonName(personId) {
  const person = people.find(p => p.id === personId);
  if (!person) return;
  const newName = prompt('Enter new name', person.name);
  if (newName && newName.trim()) {
    person.name = newName.trim();
    renderPeople();
    renderItems();
  }
}

function updatePersonAmount(personId, amount) {
  const person = people.find(p => p.id === personId);
  if (!person) return;
  person.customAmount = parseFloat(amount) || 0;
}

function updatePersonPayment(personId, method) {
  const person = people.find(p => p.id === personId);
  if (!person) return;
  person.paymentMethod = method;
}

/* ===== Items CRUD UI ===== */
function addItem() {
  const iid = itemIdCounter++;
  const sharedBy = people.map(p => p.id);
  items.push({ id: iid, name: `Item ${iid}`, price: 0, sharedBy });
  renderItems();
}

function removeItem(itemId) {
  items = items.filter(i => i.id !== itemId);
  renderItems();
}

function renderItems() {
  const container = document.getElementById('itemsContainer');
  if (!container) return;
  container.innerHTML = '';

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';

    // Header
    const header = document.createElement('div');
    header.className = 'item-header';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'person-input item-name-input';
    nameInput.value = item.name;
    nameInput.placeholder = 'Item name';
    nameInput.style.width = '60%';
    nameInput.addEventListener('change', function () { updateItemName(item.id, this.value); });

    const priceDiv = document.createElement('div');
    priceDiv.className = 'item-price';
    priceDiv.innerHTML = '$';
    const priceInput = document.createElement('input');
    priceInput.type = 'number';
    priceInput.className = 'item-price-input';
    priceInput.value = item.price;
    priceInput.placeholder = '0.00';
    priceInput.step = '0.01';
    priceInput.style.width = '80px';
    priceInput.style.border = 'none';
    priceInput.style.background = 'transparent';
    priceInput.style.fontWeight = '700';
    priceInput.style.color = '#e74c3c';
    priceInput.addEventListener('change', function () { updateItemPrice(item.id, this.value); });

    priceDiv.appendChild(priceInput);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'control-btn delete';
    delBtn.title = 'Remove Item';
    delBtn.setAttribute('aria-label', `Remove ${item.name}`);
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    delBtn.addEventListener('click', () => removeItem(item.id));

    header.appendChild(nameInput);
    header.appendChild(priceDiv);
    header.appendChild(delBtn);

    // Shared by
    const sharedLabel = document.createElement('div');
    const label = document.createElement('label');
    label.style.color = '#666';
    label.style.fontSize = '0.9rem';
    label.style.display = 'block';
    label.textContent = 'Shared by (click to toggle):';
    sharedLabel.appendChild(label);

    const sharedContainer = document.createElement('div');
    sharedContainer.className = 'shared-with';

    (people || []).forEach(person => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'person-tag';
      if (Array.isArray(item.sharedBy) && item.sharedBy.includes(person.id)) btn.classList.add('selected');
      btn.setAttribute('aria-pressed', (Array.isArray(item.sharedBy) && item.sharedBy.includes(person.id)) ? 'true' : 'false');
      btn.innerHTML = escapeHtml(person.name) + ' ' + (Array.isArray(item.sharedBy) && item.sharedBy.includes(person.id) ? '<i class="fas fa-check"></i>' : '<i class="fas fa-times"></i>');
      btn.addEventListener('click', () => togglePersonForItem(item.id, person.id));
      sharedContainer.appendChild(btn);
    });

    sharedLabel.appendChild(sharedContainer);
    card.appendChild(header);
    card.appendChild(sharedLabel);

    container.appendChild(card);
  });
}

function updateItemName(itemId, name) {
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  it.name = name;
}

function updateItemPrice(itemId, price) {
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  it.price = parseFloat(price) || 0;
}

function togglePersonForItem(itemId, personId) {
  const it = items.find(i => i.id === itemId);
  if (!it) return;
  it.sharedBy = it.sharedBy || [];
  const idx = it.sharedBy.indexOf(personId);
  if (idx > -1) it.sharedBy.splice(idx, 1);
  else it.sharedBy.push(personId);
  if (it.sharedBy.length === 0) {
    // keep at least one person assigned
    it.sharedBy.push(personId);
    alert('At least one person must be assigned to each item!');
  }
  renderItems();
}

/* ===== Warnings ===== */
function showWarning(message) {
  const warning = document.getElementById('warningMessage');
  const warningText = document.getElementById('warningText');
  if (!warning || !warningText) {
    alert(message);
    return;
  }
  warningText.textContent = message;
  warning.classList.add('show');
  setTimeout(() => warning.classList.remove('show'), 5000);
}

/* ===== Calculation Logic ===== */
function calculateSplit() {
  const billTotalRaw = document.getElementById('billTotal') ? document.getElementById('billTotal').value : '';
  const billTotal = parseFloat(String(billTotalRaw).replace(/[^0-9.\-]/g, '')) || 0;
  const tipValueRaw = document.getElementById('tipValue') ? document.getElementById('tipValue').value : '0';
  const tipValue = parseFloat(tipValueRaw) || 0;
  const taxPercent = parseFloat(document.getElementById('taxPercent') ? document.getElementById('taxPercent').value : '0') || 0;

  if (billTotal <= 0) { alert('Please enter a valid bill amount!'); return; }
  if (!people || people.length === 0) { alert('Please add at least one person!'); return; }

  let tipAmount = 0;
  if (currentTipType === 'percent') tipAmount = (billTotal * tipValue) / 100;
  else tipAmount = tipValue;

  const taxAmount = (billTotal * taxPercent) / 100;
  const totalWithTipTax = billTotal + tipAmount + taxAmount;

  // init person totals
  const personTotals = {};
  people.forEach(p => {
    personTotals[p.id] = {
      id: p.id,
      name: p.name,
      paymentMethod: p.paymentMethod || 'cash',
      subtotal: 0,
      itemDetails: [],
      tip: 0,
      tax: 0,
      total: 0
    };
  });

  // Determine subtotals
  if (currentSplitMethod === 'custom') {
    const hasCustom = people.some(p => (p.customAmount || 0) > 0);
    if (hasCustom) {
      const totalCustom = people.reduce((s, p) => s + (p.customAmount || 0), 0);
      if (Math.abs(totalCustom - billTotal) > 0.01) {
        showWarning(`Custom amounts total ${totalCustom.toFixed(2)} but bill is ${billTotal.toFixed(2)}.`);
      }
      people.forEach(p => {
        personTotals[p.id].subtotal = p.customAmount || 0;
        personTotals[p.id].itemDetails.push({ name: 'Custom amount', amount: personTotals[p.id].subtotal, sharedWith: 1 });
      });
    } else {
      const equal = billTotal / people.length;
      people.forEach(p => {
        personTotals[p.id].subtotal = equal;
        personTotals[p.id].itemDetails.push({ name: 'Equal share of bill', amount: equal, sharedWith: people.length });
      });
    }
  } else if (items && items.length > 0 && items.some(it => (it.price || 0) > 0)) {
    let totalItemsPrice = 0;
    items.forEach(it => {
      const price = parseFloat(it.price) || 0;
      const sharers = Array.isArray(it.sharedBy) && it.sharedBy.length ? it.sharedBy : people.map(p => p.id);
      if (price > 0 && sharers.length > 0) {
        const per = price / sharers.length;
        totalItemsPrice += price;
        sharers.forEach(pid => {
          if (personTotals[pid]) {
            personTotals[pid].subtotal += per;
            personTotals[pid].itemDetails.push({ name: it.name, amount: per, sharedWith: sharers.length });
          }
        });
      }
    });
    if (totalItemsPrice > billTotal + 0.01) {
      showWarning(`Item totals ($${totalItemsPrice.toFixed(2)}) exceed bill total ($${billTotal.toFixed(2)}). Using items as base.`);
    }
    const remaining = billTotal - totalItemsPrice;
    if (Math.abs(remaining) > 0.01) {
      const perRem = remaining / people.length;
      people.forEach(p => {
        personTotals[p.id].subtotal += perRem;
        personTotals[p.id].itemDetails.push({ name: remaining > 0 ? 'Other charges' : 'Discount applied', amount: perRem, sharedWith: people.length });
      });
    }
  } else {
    const equal = billTotal / people.length;
    people.forEach(p => {
      personTotals[p.id].subtotal = equal;
      personTotals[p.id].itemDetails.push({ name: 'Equal share of bill', amount: equal, sharedWith: people.length });
    });
  }

  // Distribute tip & tax proportionally (safe fallback if sumSubtotals == 0)
  const sumSubtotals = Object.values(personTotals).reduce((s, v) => s + (v.subtotal || 0), 0);
  if (sumSubtotals <= 0.0000001) {
    const eachTip = tipAmount / people.length;
    const eachTax = taxAmount / people.length;
    people.forEach(p => {
      personTotals[p.id].tip = eachTip;
      personTotals[p.id].tax = eachTax;
      personTotals[p.id].total = (personTotals[p.id].subtotal || 0) + eachTip + eachTax;
    });
  } else {
    people.forEach(p => {
      const prop = (personTotals[p.id].subtotal || 0) / sumSubtotals;
      const pTip = tipAmount * prop;
      const pTax = taxAmount * prop;
      personTotals[p.id].tip = pTip;
      personTotals[p.id].tax = pTax;
      personTotals[p.id].total = (personTotals[p.id].subtotal || 0) + pTip + pTax;
    });
  }

  // Rounding fix to ensure totals match exactly
  let roundedSum = 0;
  Object.values(personTotals).forEach(pt => {
    pt.total = Math.round((pt.total || 0) * 100) / 100;
    roundedSum += pt.total;
  });

  const roundingDiff = Math.round((totalWithTipTax - roundedSum) * 100) / 100;
  if (Math.abs(roundingDiff) >= 0.01) {
    const lastPid = people[people.length - 1].id;
    personTotals[lastPid].total = Math.round((personTotals[lastPid].total + roundingDiff) * 100) / 100;
  }

  lastResults = {
    personTotals: JSON.parse(JSON.stringify(personTotals)),
    totals: { billTotal, tipAmount, taxAmount, totalWithTipTax, tipPercent: currentTipType === 'percent' ? tipValue : null, tipAmountUser: currentTipType === 'amount' ? tipValue : null, taxPercent }
  };

  displayResults(personTotals, lastResults.totals);
}

/* ===== Display Results ===== */
function displayResults(personTotals, totals) {
  const resultsSection = document.getElementById('resultsSection');
  const resultsGrid = document.getElementById('resultsGrid');
  const totalWithTipTaxEl = document.getElementById('totalWithTipTax');

  if (resultsSection) {
    resultsSection.style.display = 'block';
    resultsSection.classList.add('animate-result');
  }
  if (totalWithTipTaxEl) totalWithTipTaxEl.textContent = formatCurrency(totals.totalWithTipTax);
  const perPersonSummaryEl = document.getElementById('perPersonSummary');

  if (perPersonSummaryEl) {
    // Always reset (important!)
    perPersonSummaryEl.style.display = 'block';
    perPersonSummaryEl.textContent = '';

    // Determine if this is custom mode
    // Use whichever variable exists in your file:
    // 1) currentSplitMethod (global)
    // 2) totals.splitMethod (if you pass it)
    const mode = (typeof currentSplitMethod !== 'undefined' && currentSplitMethod)
      ? currentSplitMethod
      : (totals && totals.splitMethod ? totals.splitMethod : 'equal');

    if (mode === 'custom') {
      // Hide only in custom mode
      perPersonSummaryEl.style.display = 'none';
    } else {
      // Show in normal/equal mode
      const arr = Object.values(personTotals).map(p => Number(p.total) || 0);
      if (arr.length) {
        // show a simple value (first person), same as you wanted
        perPersonSummaryEl.textContent = `Each person pays: ${formatCurrency(arr[0])}`;
      }
    }
  }

  if (resultsGrid) resultsGrid.innerHTML = '';

  // Mobile sticky card
  const stickyCard = document.getElementById('stickyResultCard');
  const stickyAmount = document.getElementById('stickyAmount');
  const stickyBillTotal = document.getElementById('stickyBillTotal');
  const stickyTip = document.getElementById('stickyTip');
  const stickyTax = document.getElementById('stickyTax');
  const stickyGrandTotal = document.getElementById('stickyGrandTotal');
  const stickyPersonList = document.getElementById('stickyPersonList');

  if (stickyAmount) stickyAmount.textContent = formatCurrency((totals.totalWithTipTax || 0) / Math.max(1, people.length));
  if (stickyBillTotal) stickyBillTotal.textContent = formatCurrency(totals.billTotal || 0);
  if (stickyTip) stickyTip.textContent = formatCurrency(totals.tipAmount || 0);
  if (stickyTax) stickyTax.textContent = formatCurrency(totals.taxAmount || 0);
  if (stickyGrandTotal) stickyGrandTotal.textContent = formatCurrency(totals.totalWithTipTax || 0);
  if (stickyCard) stickyCard.classList.add('visible');

  const paymentIcon = {
    cash: 'fas fa-money-bill-wave',
    card: 'fas fa-credit-card',
    venmo: 'fab fa-venmo',
    paypal: 'fab fa-paypal',
    zelle: 'fas fa-university'
  };

  // sticky list
  if (stickyPersonList) {
    stickyPersonList.innerHTML = '';
    Object.values(personTotals).forEach(pt => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '0.5rem';
      row.style.background = 'rgba(255,255,255,0.1)';
      row.style.margin = '0.5rem 0';
      row.style.borderRadius = '8px';
      row.innerHTML = `<span><i class="${paymentIcon[pt.paymentMethod] || 'fas fa-wallet'}"></i> ${escapeHtml(pt.name)}</span><strong>${formatCurrency(pt.total)}</strong>`;
      stickyPersonList.appendChild(row);
    });
  }

  // desktop grid
  if (resultsGrid) {
    Object.values(personTotals).forEach(pt => {
      const card = document.createElement('div');
      card.className = 'person-result';

      const h4 = document.createElement('h4');
      h4.innerHTML = `<i class="${paymentIcon[pt.paymentMethod] || 'fas fa-wallet'}"></i> ${escapeHtml(pt.name)}`;
      card.appendChild(h4);

      const amt = document.createElement('div');
      amt.className = 'amount-owed';
      amt.textContent = formatCurrency(pt.total);
      card.appendChild(amt);

      const breakdown = document.createElement('div');
      breakdown.className = 'item-breakdown';

      const subRow = document.createElement('div');
      subRow.className = 'breakdown-item';
      subRow.innerHTML = `<span>Subtotal:</span><span>${formatCurrency(pt.subtotal)}</span>`;
      breakdown.appendChild(subRow);

      if (pt.tip && pt.tip > 0) {
        const tipRow = document.createElement('div');
        tipRow.className = 'breakdown-item';
        tipRow.innerHTML = `<span>Tip:</span><span>${formatCurrency(pt.tip)}</span>`;
        breakdown.appendChild(tipRow);
      }
      if (pt.tax && pt.tax > 0) {
        const taxRow = document.createElement('div');
        taxRow.className = 'breakdown-item';
        taxRow.innerHTML = `<span>Tax:</span><span>${formatCurrency(pt.tax)}</span>`;
        breakdown.appendChild(taxRow);
      }

      const totalRow = document.createElement('div');
      totalRow.className = 'breakdown-item';
      totalRow.style.borderTop = '2px solid rgba(255,255,255,0.3)';
      totalRow.style.marginTop = '0.5rem';
      totalRow.style.paddingTop = '0.5rem';
      totalRow.style.fontWeight = 'bold';
      totalRow.innerHTML = `<span>Total:</span><span>${formatCurrency(pt.total)}</span>`;
      breakdown.appendChild(totalRow);

      if (pt.itemDetails && pt.itemDetails.length) {
        const itemsDiv = document.createElement('div');
        itemsDiv.style.marginTop = '1rem';
        itemsDiv.style.fontSize = '0.8rem';
        itemsDiv.style.opacity = '0.9';
        const strong = document.createElement('strong');
        strong.textContent = 'Items:';
        itemsDiv.appendChild(strong);
        itemsDiv.appendChild(document.createElement('br'));
        pt.itemDetails.forEach(d => {
          const line = document.createElement('div');
          line.textContent = `• ${d.name}: ${formatCurrency(d.amount)}${d.sharedWith > 1 ? ` (split ${d.sharedWith} ways)` : ''}`;
          itemsDiv.appendChild(line);
        });
        breakdown.appendChild(itemsDiv);
      }

      card.appendChild(breakdown);
      resultsGrid.appendChild(card);
    });
  }

  resultsSection && resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ===== Export / Share / Print ===== */
function exportToText() {
  if (!lastResults) { alert('Please calculate the split first!'); return; }
  const { personTotals, totals } = lastResults;
  let txt = 'BILL SPLIT SUMMARY\n==================\n\n';
  txt += `Original Bill: ${formatCurrency(totals.billTotal)}\n`;
  if (totals.tipAmount && totals.tipAmount > 0) {
    if (totals.tipPercent != null) txt += `Tip (${totals.tipPercent}%): ${formatCurrency(totals.tipAmount)}\n`;
    else txt += `Tip: ${formatCurrency(totals.tipAmount)}\n`;
  }
  if (totals.taxAmount && totals.taxAmount > 0) txt += `Tax (${totals.taxPercent}%): ${formatCurrency(totals.taxAmount)}\n`;
  txt += `Total: ${formatCurrency(totals.totalWithTipTax)}\n\n`;
  txt += 'INDIVIDUAL AMOUNTS:\n------------------\n';
  Object.values(personTotals).forEach(pt => {
    txt += `${pt.name}: ${formatCurrency(pt.total)}\n`;
    if (pt.itemDetails && pt.itemDetails.length) {
      pt.itemDetails.forEach(d => {
        txt += `  - ${d.name}: ${formatCurrency(d.amount)}\n`;
      });
    }
    txt += '\n';
  });
  txt += `Generated by usefreecalculator.com\n${new Date().toLocaleString()}\n`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(() => alert('Results copied to clipboard!')).catch(() => fallbackTextExport(txt));
  } else {
    fallbackTextExport(txt);
  }
}

function fallbackTextExport(exportText) {
  const w = window.open('', '_blank');
  if (!w) { alert('Please allow popups to export results.'); return; }
  // Write minimal HTML, then attach event listeners from parent (no inner <script> in string)
  const preHtml = escapeHtml(exportText);
  w.document.open();
  w.document.write('<!doctype html><html><head><title>Bill Split Results</title></head><body style="font-family: Arial, Helvetica, sans-serif; padding:20px;">');
  w.document.write('<pre id="pre" style="white-space: pre-wrap; word-wrap: break-word; padding:10px; border:1px solid #ddd;">' + preHtml + '</pre>');
  w.document.write('<div style="margin-top:12px;"><button id="copyBtn">Copy to Clipboard</button></div>');
  w.document.write('</body></html>');
  w.document.close();
  // Attach listener safely
  w.addEventListener('load', function () {
    try {
      const btn = w.document.getElementById('copyBtn');
      const pre = w.document.getElementById('pre');
      if (btn && pre && navigator.clipboard && navigator.clipboard.writeText) {
        btn.addEventListener('click', function () {
          navigator.clipboard.writeText(pre.textContent).then(() => { alert('Copied!'); }).catch(() => { alert('Copy failed'); });
        });
      }
    } catch (e) {
      // ignore cross-window attach errors (shouldn't occur same-origin)
    }
  });
}

function shareResults() {
  if (!lastResults) { alert('Please calculate the split first!'); return; }
  const { personTotals, totals } = lastResults;
  let shareText = `💰 Bill Split Results 💰\n\nTotal: ${formatCurrency(totals.totalWithTipTax)}\n\nIndividual amounts:\n`;
  Object.values(personTotals).forEach(pt => { shareText += `• ${pt.name}: ${formatCurrency(pt.total)}\n`; });
  shareText += `\nCalculated with Free Calculator`;

  if (navigator.share) {
    navigator.share({ title: 'Bill Split Results', text: shareText }).catch(() => fallbackShare(shareText));
  } else {
    fallbackShare(shareText);
  }
}

function fallbackShare(shareText) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(shareText).then(() => alert('Share text copied to clipboard!')).catch(() => manualShare(shareText));
  } else {
    manualShare(shareText);
  }
}

function manualShare(shareText) {
  const w = window.open('', '_blank', 'width=520,height=600');
  if (!w) { alert('Please allow popups to share results.'); return; }
  const preHtml = escapeHtml(shareText);
  w.document.open();
  w.document.write('<!doctype html><html><head><title>Share Bill Split</title></head><body style="font-family: Arial, Helvetica, sans-serif; padding:20px;">');
  w.document.write('<pre id="pre" style="white-space: pre-wrap; word-wrap: break-word; padding:10px; border:1px solid #ddd;">' + preHtml + '</pre>');
  w.document.write('<div style="margin-top:12px;"><button id="copyBtn">Copy</button></div>');
  w.document.write('</body></html>');
  w.document.close();
  w.addEventListener('load', function () {
    try {
      const btn = w.document.getElementById('copyBtn');
      const pre = w.document.getElementById('pre');
      if (btn && pre && navigator.clipboard && navigator.clipboard.writeText) {
        btn.addEventListener('click', function () {
          navigator.clipboard.writeText(pre.textContent).then(() => { alert('Copied!'); }).catch(() => { alert('Copy failed'); });
        });
      }
    } catch (e) { /* ignore */ }
  });
}

function printResults() {
  if (!lastResults) { alert('Please calculate the split first!'); return; }

  const { personTotals, totals } = lastResults;

  const dateStr = new Date().toLocaleString();
  const rows = Object.values(personTotals).map(pt => {
    const itemsHtml = (pt.itemDetails && pt.itemDetails.length)
      ? `<ul>${pt.itemDetails.map(d =>
        `<li>${escapeHtml(d.name)}: ${formatCurrency(d.amount)}${d.sharedWith > 1 ? ` (split ${d.sharedWith} ways)` : ''}</li>`
      ).join('')}</ul>`
      : `<div style="opacity:.85;">No item details</div>`;

    return `
      <div class="card">
        <h3>${escapeHtml(pt.name)}</h3>
        <div class="big">${formatCurrency(pt.total)}</div>
        <div class="mini">
          <div><span>Subtotal</span><span>${formatCurrency(pt.subtotal)}</span></div>
          <div><span>Tip</span><span>${formatCurrency(pt.tip)}</span></div>
          <div><span>Tax</span><span>${formatCurrency(pt.tax)}</span></div>
          <div class="total"><span>Total</span><span>${formatCurrency(pt.total)}</span></div>
        </div>
        <div class="items">
          <strong>Items</strong>
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) { alert('Please allow popups to print.'); return; }

  w.document.open();
  w.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Bill Split Results</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:24px;color:#111}
    .wrap{max-width:900px;margin:0 auto}
    .header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px}
    .title{font-size:22px;font-weight:800;margin:0}
    .meta{font-size:12px;opacity:.8}
    .summary{border:1px solid #ddd;border-radius:12px;padding:14px;margin:14px 0}
    .summary .row{display:flex;justify-content:space-between;gap:12px;margin:6px 0}
    .summary .grand{font-weight:800;border-top:1px solid #ddd;padding-top:8px;margin-top:8px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}
    .card{border:1px solid #ddd;border-radius:12px;padding:14px;break-inside:avoid}
    .card h3{margin:0 0 6px 0;font-size:16px}
    .big{font-size:22px;font-weight:800;margin:0 0 10px 0}
    .mini{border-radius:10px;background:#f6f6f6;padding:10px}
    .mini > div{display:flex;justify-content:space-between;gap:10px;margin:6px 0}
    .mini .total{font-weight:800;border-top:1px solid #ddd;padding-top:8px;margin-top:8px}
    .items{margin-top:10px;font-size:13px}
    .items ul{margin:8px 0 0 18px;padding:0}
    .actions{margin-top:14px;display:flex;gap:10px;justify-content:flex-end}
    button{padding:10px 14px;border-radius:10px;border:1px solid #bbb;background:#fff;cursor:pointer}
    button.primary{border-color:#111;background:#111;color:#fff}
    @media (max-width:680px){.grid{grid-template-columns:1fr}}
    @media print{
      .actions{display:none !important}
      body{padding:0}
      .wrap{max-width:100%;margin:0}
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div>
        <h1 class="title">Bill Split Results</h1>
        <div class="meta">Generated: ${escapeHtml(dateStr)}</div>
        <div style="
          font-size:15px;
          font-weight:600;
          margin-top:6px;
          margin-bottom:6px;
          color:#444;
        ">
          All amounts use the same currency as the original bill
        </div>

      </div>
      
      <div class="actions">
        <button onclick="window.close()">Close</button>
        <button class="primary" onclick="window.print()">Print</button>
      </div>
    </div>

    <div class="summary">
      <div class="row"><span>Original Bill</span><span>${formatCurrency(totals.billTotal)}</span></div>
      <div class="row"><span>Tip</span><span>${formatCurrency(totals.tipAmount || 0)}</span></div>
      <div class="row"><span>Tax</span><span>${formatCurrency(totals.taxAmount || 0)}</span></div>
      <div class="row grand"><span>Grand Total</span><span>${formatCurrency(totals.totalWithTipTax)}</span></div>
    </div>

    <div class="grid">
      ${rows}
    </div>

    <div class="meta" style="margin-top:14px;">Generated using usefreecalculator.com</div>
  </div>
</body>
</html>`);
  w.document.close();

  // Optional: auto-open print after load
  w.addEventListener('load', () => {
    w.print(); // uncomment if you want auto-print
  });
}


/* ===== Init ===== */
document.addEventListener('DOMContentLoaded', function () {
  // Initialize people count if element present, use value or default 2
  const countEl = document.getElementById('peopleCount');
  if (countEl) {
    const initCount = Math.max(1, parseInt(countEl.textContent, 10) || 2);
    countEl.textContent = initCount;
  }

  // Seed people array to match counter
  syncPeopleArray();

  // Set default tip type and split method to reflect UI
  setTipType(currentTipType);
  quickSplit(currentSplitMethod);

  // Open first step by default (if collapsed behavior expected)
  const step1 = document.getElementById('step1Content');
  if (step1 && !step1.classList.contains('open')) toggleStep(1);

});
