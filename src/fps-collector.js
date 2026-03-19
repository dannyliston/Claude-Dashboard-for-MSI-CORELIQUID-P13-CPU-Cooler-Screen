const { execSync } = require('child_process');

class GpuCollector {
  constructor() {
    this._gpu = null;
  }

  poll() {
    try {
      const output = execSync(
        'nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits',
        { timeout: 3000, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      const val = parseInt(output.trim(), 10);
      this._gpu = isNaN(val) ? null : val;
    } catch {
      this._gpu = null;
    }
  }

  getFps() {
    return this._gpu;
  }
}

module.exports = GpuCollector;
