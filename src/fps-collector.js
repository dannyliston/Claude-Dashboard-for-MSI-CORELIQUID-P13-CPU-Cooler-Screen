const { exec } = require('child_process');

class GpuCollector {
  constructor() {
    this._gpu = null;
    this._pending = false;
  }

  poll() {
    // Skip if a previous poll is still running
    if (this._pending) return;
    this._pending = true;

    exec(
      'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits',
      { timeout: 5000, windowsHide: true },
      (err, stdout) => {
        this._pending = false;
        if (err) { this._gpu = null; return; }
        const val = parseInt(stdout.trim(), 10);
        this._gpu = isNaN(val) ? null : val;
      }
    );
  }

  getFps() {
    return this._gpu;
  }
}

module.exports = GpuCollector;
