function parseOptionsAndRun(metrics) {
  const runsCount = document.querySelector("#runs-count");
  const runs = parseInt(runsCount.options[runsCount.selectedIndex].value, 10);
  return doWork(runs, metrics);
}

async function runTests() {
  if (!("fonts" in navigator) || !("query" in navigator.fonts)) {
    alert("Font Access API not detected. Will not work.");
    return;
  }
  const status = document.querySelector('#status');
  status.innerText = "Running...";

  const metrics = await parseOptionsAndRun([]);
  updateMetricsResults(metrics);
  status.innerText = "";
}

function clearAll() {
  let tbody = document.querySelector("#runs tbody");
  tbody.innerText = "";
}

function updateMetricsResults(metrics) {
  const pre = document.querySelector('#metrics-data');
  pre.innerText = JSON.stringify(metrics);
  insertSaveButton(metrics);
}

function insertSaveButton(data) {
  if (!window.chooseFileSystemEntries) {
    alert("Native Filesystem API not detected. Will not work. Copy/Paste instead.");
    return;
  }

  const saveArea = document.querySelector('#save-area');
  const button = document.createElement("button");
  button.addEventListener('click', ((data) => {
    return async () => {
      const handle = await window.chooseFileSystemEntries({type: "save-file"});
      const writer = await handle.createWritable();
      writer.write(JSON.stringify(data));
      writer.close();
    };
  })(data));
  button.innerText = "Save Data";

  saveArea.innerHTML = ""; // Clear previous results.
  saveArea.appendChild(button);
}

function updateMetrics(testName, elapsedMillis, tableDataMetrics, metrics) {
  let data = {};
  data[testName] = {run_elapsed_ms: elapsedMillis, font_table_metrics: tableDataMetrics};
  metrics.push(data);
}

function humanReadableBytes(bytes) {
  if (bytes == 0) { return "0 B"; }
  let e = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes/Math.pow(1024, e)).toFixed(2)+' '+' KMGTP'.charAt(e)+'iB';
}

function humanReadableTime(ms){
  var SECOND_MS = 1000;
  var MINUTE_MS = 60 * SECOND_MS;
  var HOUR_MS = 60 * MINUTE_MS;
  var DAY_MS = 24 * HOUR_MS;
  var WEEK_MS = 7 * DAY_MS;
  var MONTH_MS = 30 * DAY_MS;

  var lookup = ["months", "weeks", "days", "hours", "mins", "secs"];
  var values = [];
  values.push(ms / MONTH_MS); ms %= MONTH_MS;
  values.push(ms / WEEK_MS); ms %= WEEK_MS;
  values.push(ms / DAY_MS); ms %= DAY_MS;
  values.push(ms / HOUR_MS); ms %= HOUR_MS;
  values.push(ms / MINUTE_MS); ms %= MINUTE_MS;
  values.push(ms / SECOND_MS); ms %= SECOND_MS;

  var pretty = "";
  for(var i=0 ; i <values.length; i++){
    var val = Math.round(values[i]);
    if(val <= 0) continue;

    pretty += values[i].toFixed(2) + " " + lookup[i];
    break;
  }
  return pretty;
}

function updateRunsTable(count, elapsed, totalBytes, totalTableAccesstime) {
  const table = document.querySelector("#runs tbody");
  const row = document.createElement("tr");
  const countCell = document.createElement("td");
  const elapsedCell = document.createElement("td");
  const perRunElapsedCell = document.createElement("td");
  const bytesCell = document.createElement("td");
  const throughputCell = document.createElement("td");

  countCell.innerText = count;
  //elapsedCell.innerText = `${elapsed} ms`;
  elapsedCell.innerText = humanReadableTime(elapsed);
  //perRunElapsedCell.innerText = `${totalTableAccesstime} ms`;
  perRunElapsedCell.innerText = humanReadableTime(totalTableAccesstime);
  bytesCell.innerText = humanReadableBytes(totalBytes);
  throughputCell.innerText = `${humanReadableBytes(totalBytes/(totalTableAccesstime/1000))}/sec`;

  row.appendChild(countCell);
  row.appendChild(elapsedCell);
  row.appendChild(perRunElapsedCell);
  row.appendChild(bytesCell);
  row.appendChild(throughputCell);

  table.appendChild(row);
}

function updateElapsed(count, elapsedMillis, tableDataMetrics, metrics = null) {
  if (metrics) {
    const testName = `font_table_access`;
    updateMetrics(testName, elapsedMillis, tableDataMetrics, metrics);
  }

}

async function doWork(runs = 1, metrics = null, show = false) {
  const table = document.querySelector("#fonts tbody");
  let overall_start = performance.now();
  let total_bytes = 0;
  let tableAccessTime = 0;
  for (let i = 0; i < runs; i++) {
    let fontTableDataMetrics = [];
    let start = performance.now();

    for await (const entry of navigator.fonts.query()) {
      const table_start = performance.now();
      let data = await entry.getTables();
      const table_end = performance.now();
      const tableElapsed = table_end - table_start;
      tableAccessTime += tableElapsed;
      let tableDataSize = 0;
      for (let name of data.keys()) {
        const tableData = data.get(name);
        total_bytes += tableData.size;
        tableDataSize += tableData.size;
      }
      fontTableDataMetrics.push({elapsed_ms: tableElapsed, size: tableDataSize});
    }
    let elapsed = performance.now() - start;
    updateElapsed(runs, elapsed, fontTableDataMetrics, metrics);
  }
  let overall_elapsed = performance.now() - overall_start;
  updateRunsTable(runs, overall_elapsed.toFixed(2), total_bytes, tableAccessTime);

  return metrics;
}
