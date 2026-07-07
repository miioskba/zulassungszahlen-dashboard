const MONTHS = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const state = {
  kennzahl: "Neuzulassungen",
  fahrzeugart: "Wohnmobile",
  payload: null,
};

const euroNumber = new Intl.NumberFormat("de-DE");
const percentNumber = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

function qs(id) {
  return document.getElementById(id);
}

function recordsFor(kennzahl, fahrzeugart) {
  return state.payload.records
    .filter((item) => item.kennzahl === kennzahl && item.fahrzeugart === fahrzeugart)
    .sort((a, b) => a.jahr - b.jahr || a.monat - b.monat);
}

function valueFor(records, year, month) {
  return records.find((item) => item.jahr === year && item.monat === month)?.wert ?? null;
}

function sumFor(records, year, maxMonth = 12) {
  return records
    .filter((item) => item.jahr === year && item.monat <= maxMonth)
    .reduce((sum, item) => sum + item.wert, 0);
}

function pct(current, previous) {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

function deltaText(value, suffix = "ggü. Vorjahr") {
  if (value === null || Number.isNaN(value)) return "kein Vergleich";
  const sign = value > 0 ? "+" : "";
  return `${sign}${percentNumber.format(value)} % ${suffix}`;
}

function setDelta(element, value, suffix) {
  element.textContent = deltaText(value, suffix);
  element.classList.remove("positive", "negative");
  if (value > 0) element.classList.add("positive");
  if (value < 0) element.classList.add("negative");
}

function latestCompletePoint(records) {
  return records.reduce((latest, item) => {
    if (!latest) return item;
    if (item.jahr > latest.jahr) return item;
    if (item.jahr === latest.jahr && item.monat > latest.monat) return item;
    return latest;
  }, null);
}

function rollingTwelve(records, endYear, endMonth) {
  const endIndex = endYear * 12 + endMonth;
  return records
    .filter((item) => {
      const index = item.jahr * 12 + item.monat;
      return index <= endIndex && index > endIndex - 12;
    })
    .reduce((sum, item) => sum + item.wert, 0);
}

function linePath(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point.x} ${point.y}`).join(" ");
}

function renderMonthlyChart(records, year, monthLimit) {
  const previousYear = year - 1;
  const width = 760;
  const height = 250;
  const pad = { top: 26, right: 22, bottom: 38, left: 44 };
  const months = Array.from({ length: monthLimit }, (_, index) => index + 1);
  const current = months.map((month) => valueFor(records, year, month));
  const previous = months.map((month) => valueFor(records, previousYear, month));
  const maxValue = Math.max(...current, ...previous, 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (index) => pad.left + (months.length === 1 ? plotW / 2 : (plotW * index) / (months.length - 1));
  const y = (value) => pad.top + plotH - (value / maxValue) * plotH;

  const currentPoints = current.map((value, index) => ({ x: x(index), y: y(value), value, month: months[index] }));
  const previousPoints = previous.map((value, index) => ({ x: x(index), y: y(value), value, month: months[index] }));
  const grid = [0.25, 0.5, 0.75, 1].map((step) => pad.top + plotH - plotH * step);

  qs("monthlyChart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      ${grid.map((lineY) => `<line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${lineY}" y2="${lineY}"></line>`).join("")}
      <path d="${linePath(previousPoints)}" fill="none" stroke="#aab3c2" stroke-width="3"></path>
      <path d="${linePath(currentPoints)}" fill="none" stroke="#1f5f9f" stroke-width="4"></path>
      ${previousPoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4" fill="#aab3c2"></circle>`).join("")}
      ${currentPoints.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="5" fill="#1f5f9f"></circle>`).join("")}
      ${currentPoints.map((point) => `<text class="point-label emphasis" x="${point.x}" y="${Math.max(14, point.y - 10)}" text-anchor="middle">${euroNumber.format(point.value)}</text>`).join("")}
      <g class="axis">
        ${months.map((month, index) => `<text x="${x(index)}" y="${height - 12}" text-anchor="middle">${MONTHS[month - 1]}</text>`).join("")}
      </g>
    </svg>
  `;
}

function renderTrendChart(records, year, monthLimit) {
  const years = [...new Set(records.map((item) => item.jahr))].sort((a, b) => a - b);
  const width = 760;
  const height = 210;
  const pad = { top: 26, right: 20, bottom: 34, left: 36 };
  const values = years.map((trendYear) => ({
    year: trendYear,
    value: sumFor(records, trendYear, trendYear === year ? monthLimit : 12),
    partial: trendYear === year,
  }));
  const maxValue = Math.max(...values.map((item) => item.value), 1);
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const gap = 26;
  const barW = Math.max(32, (plotW - gap * (values.length - 1)) / values.length);

  qs("trendChart").innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <line class="grid-line" x1="${pad.left}" x2="${width - pad.right}" y1="${pad.top + plotH}" y2="${pad.top + plotH}"></line>
      ${values.map((item, index) => {
        const x = pad.left + index * (barW + gap);
        const barH = (item.value / maxValue) * plotH;
        const y = pad.top + plotH - barH;
        const color = item.partial ? "#c99026" : "#1f5f9f";
        const label = item.partial ? `${item.year} YTD` : item.year;
        return `
          <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="5" fill="${color}"></rect>
          <text class="bar-label emphasis" x="${x + barW / 2}" y="${Math.max(14, y - 8)}" text-anchor="middle">${euroNumber.format(item.value)}</text>
          <text class="bar-label" x="${x + barW / 2}" y="${height - 10}" text-anchor="middle">${label}</text>
        `;
      }).join("")}
    </svg>
  `;
}

function update() {
  const records = recordsFor(state.kennzahl, state.fahrzeugart);
  const latest = latestCompletePoint(records);
  const year = latest.jahr;
  const month = latest.monat;
  const previousYear = year - 1;
  const currentValue = valueFor(records, year, month);
  const previousValue = valueFor(records, previousYear, month);
  const ytdValue = sumFor(records, year, month);
  const ytdPrevious = sumFor(records, previousYear, month);
  const rollingValue = rollingTwelve(records, year, month);
  const rollingPrevious = rollingTwelve(records, previousYear, month);

  qs("headline").textContent = `${state.kennzahl} ${state.fahrzeugart}`;
  qs("subline").textContent = `Aktueller Stand: ${MONTH_NAMES[month - 1]} ${year}`;
  qs("sourceLabel").textContent = state.payload.meta.quelle;
  qs("currentValue").textContent = euroNumber.format(currentValue);
  qs("currentLabel").textContent = `${state.kennzahl} im ${MONTH_NAMES[month - 1]} ${year}`;
  setDelta(qs("currentDelta"), pct(currentValue, previousValue), `gegenüber ${MONTH_NAMES[month - 1]} ${previousYear}`);
  qs("ytdValue").textContent = euroNumber.format(ytdValue);
  qs("ytdLabel").textContent = `Jan-${MONTHS[month - 1]} ${year}: ${euroNumber.format(ytdPrevious)} im Vorjahr`;
  setDelta(qs("ytdDelta"), pct(ytdValue, ytdPrevious), `Jan-${MONTHS[month - 1]} vs. Vorjahr`);
  qs("rollingValue").textContent = euroNumber.format(rollingValue);
  setDelta(qs("rollingDelta"), pct(rollingValue, rollingPrevious), "rollierend");
  qs("legendCurrent").textContent = year;
  qs("legendPrevious").textContent = previousYear;
  qs("monthlyCaption").textContent = `${MONTH_NAMES[0]} bis ${MONTH_NAMES[month - 1]} ${year} im Vergleich zu ${previousYear}`;
  qs("trendCaption").textContent = `Jahressummen, ${year} bis ${MONTH_NAMES[month - 1]}`;
  qs("statusNote").textContent = `${year} ist bis ${MONTH_NAMES[month - 1]} befüllt; spätere Monate werden automatisch ergänzt.`;

  renderMonthlyChart(records, year, month);
  renderTrendChart(records, year, month);
}

function bindControls() {
  document.querySelectorAll(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      const field = button.dataset.field;
      state[field] = button.dataset.value;
      document.querySelectorAll(`.segment[data-field="${field}"]`).forEach((item) => {
        item.classList.toggle("is-active", item === button);
      });
      update();
    });
  });
}

async function init() {
  const response = await fetch("data/kennzahlen.json");
  state.payload = await response.json();
  bindControls();
  update();
}

init();
